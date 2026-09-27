"use strict";

const { query, withTransaction } = require("../db/pool");
const { calculatePricing } = require("../utils/pricing");
const { reference } = require("../utils/references");
const { config } = require("../config");

function httpError(status, message, details) {
    const error = new Error(message);
    error.status = status;
    error.details = details;
    return error;
}

async function releaseExpiredHolds(client) {
    await client.query(
        `UPDATE bookings
         SET status = 'expired', updated_at = NOW()
         WHERE status = 'pending' AND expires_at < NOW()`
    );
    await client.query(
        `UPDATE showtime_seats ss
         SET status = 'available', booking_id = NULL, held_until = NULL
         FROM bookings b
         WHERE ss.booking_id = b.id
           AND b.status = 'expired'
           AND ss.status = 'held'`
    );
}

async function loadShowtime(client, showtimeId, lock = false) {
    const result = await client.query(
        `SELECT s.id, s.movie_id, s.screen_id, s.starts_at, s.price_cents, s.status,
                m.slug, m.title, m.genre, m.certificate, m.poster_gradient,
                sc.name AS screen_name
         FROM showtimes s
         JOIN movies m ON m.id = s.movie_id
         JOIN screens sc ON sc.id = s.screen_id
         WHERE s.id = $1
           AND s.status = 'scheduled'
           AND s.starts_at > NOW()
         ${lock ? "FOR UPDATE OF s" : ""}`,
        [showtimeId]
    );
    if (!result.rows[0]) throw httpError(404, "Showtime not found or no longer available.");
    return result.rows[0];
}

async function loadPromo(client, promoCode) {
    if (!promoCode) return null;
    const result = await client.query(
        `SELECT id, code, percentage_off
         FROM promo_codes
         WHERE UPPER(code) = UPPER($1)
           AND active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [promoCode]
    );
    if (!result.rows[0]) throw httpError(400, "Promo code is not valid.");
    return result.rows[0];
}

async function loadRequestedSeats(client, showtime, seatCodes, lock = false) {
    const result = await client.query(
        `SELECT seat.id, seat.seat_code, seat.row_label, seat.seat_number,
                ss.status, ss.held_until, ss.booking_id
         FROM seats seat
         JOIN showtime_seats ss ON ss.seat_id = seat.id AND ss.showtime_id = $1
         WHERE seat.screen_id = $2 AND seat.seat_code = ANY($3::text[])
         ORDER BY seat.row_label, seat.seat_number
         ${lock ? "FOR UPDATE OF ss" : ""}`,
        [showtime.id, showtime.screen_id, seatCodes]
    );

    if (result.rows.length !== seatCodes.length) {
        throw httpError(400, "One or more requested seats do not exist.");
    }

    const unavailable = result.rows.filter((seat) => {
        if (seat.status === "available") return false;
        if (seat.status === "held" && seat.held_until && new Date(seat.held_until) < new Date()) return false;
        return true;
    });

    if (unavailable.length) {
        throw httpError(409, "One or more seats are no longer available.", unavailable.map((seat) => seat.seat_code));
    }

    return result.rows;
}

async function quoteBooking({ showtimeId, seatCodes, promoCode }) {
    return withTransaction(async (client) => {
        await releaseExpiredHolds(client);
        const showtime = await loadShowtime(client, showtimeId);
        const seats = await loadRequestedSeats(client, showtime, seatCodes);
        const promo = await loadPromo(client, promoCode);
        const pricing = calculatePricing({
            seatCount: seats.length,
            priceCents: showtime.price_cents,
            percentageOff: promo?.percentage_off || 0
        });
        return { showtime, seats, promo, ...pricing };
    });
}

async function createBooking({ userId, showtimeId, seatCodes, promoCode }) {
    const bookingId = await withTransaction(async (client) => {
        await releaseExpiredHolds(client);
        const showtime = await loadShowtime(client, showtimeId, true);
        const seats = await loadRequestedSeats(client, showtime, seatCodes, true);
        const promo = await loadPromo(client, promoCode);
        const pricing = calculatePricing({
            seatCount: seats.length,
            priceCents: showtime.price_cents,
            percentageOff: promo?.percentage_off || 0
        });

        const bookingResult = await client.query(
            `INSERT INTO bookings
                (reference, user_id, showtime_id, promo_code_id, subtotal_cents, discount_cents, total_cents, expires_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() + ($8 || ' minutes')::interval)
             RETURNING id`,
            [reference("BK"), userId, showtime.id, promo?.id || null, pricing.subtotalCents, pricing.discountCents, pricing.totalCents, config.seatHoldMinutes]
        );
        const id = bookingResult.rows[0].id;
        const seatIds = seats.map((seat) => seat.id);

        await client.query(
            `UPDATE showtime_seats
             SET status = 'held', booking_id = $1,
                 held_until = NOW() + ($2 || ' minutes')::interval
             WHERE showtime_id = $3 AND seat_id = ANY($4::uuid[])`,
            [id, config.seatHoldMinutes, showtime.id, seatIds]
        );

        for (const seat of seats) {
            await client.query(
                `INSERT INTO booking_seats (booking_id, seat_id, price_cents)
                 VALUES ($1, $2, $3)`,
                [id, seat.id, showtime.price_cents]
            );
        }
        return id;
    });

    return getBookingById(bookingId, userId);
}

async function getBookingById(bookingId, userId = null, allowAdmin = false) {
    const params = [bookingId];
    let ownershipSql = "";
    if (userId && !allowAdmin) {
        params.push(userId);
        ownershipSql = `AND b.user_id = $${params.length}`;
    }

    const result = await query(
        `SELECT b.id, b.reference, b.status, b.subtotal_cents, b.discount_cents, b.total_cents,
                b.expires_at, b.created_at, b.stripe_checkout_session_id,
                s.id AS showtime_id, s.starts_at, m.slug AS movie_slug, m.title AS movie_title,
                sc.name AS screen_name, u.name AS customer_name, u.email AS customer_email,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'seatId', seat.id,
                            'seatCode', seat.seat_code,
                            'ticketCode', t.code,
                            'ticketStatus', t.status
                        ) ORDER BY seat.row_label, seat.seat_number
                    ) FILTER (WHERE seat.id IS NOT NULL), '[]'
                ) AS seats
         FROM bookings b
         JOIN users u ON u.id = b.user_id
         JOIN showtimes s ON s.id = b.showtime_id
         JOIN movies m ON m.id = s.movie_id
         JOIN screens sc ON sc.id = s.screen_id
         LEFT JOIN booking_seats bs ON bs.booking_id = b.id
         LEFT JOIN seats seat ON seat.id = bs.seat_id
         LEFT JOIN tickets t ON t.booking_id = b.id AND t.seat_id = seat.id
         WHERE b.id = $1 ${ownershipSql}
         GROUP BY b.id, s.id, m.slug, m.title, sc.name, u.name, u.email`,
        params
    );
    if (!result.rows[0]) throw httpError(404, "Booking not found.");
    return result.rows[0];
}

async function getUserBookings(userId) {
    const result = await query(
        `SELECT b.id, b.reference, b.status, b.total_cents, b.created_at,
                s.starts_at, m.slug AS movie_slug, m.title AS movie_title,
                string_agg(seat.seat_code, ', ' ORDER BY seat.row_label, seat.seat_number) AS seat_codes
         FROM bookings b
         JOIN showtimes s ON s.id = b.showtime_id
         JOIN movies m ON m.id = s.movie_id
         LEFT JOIN booking_seats bs ON bs.booking_id = b.id
         LEFT JOIN seats seat ON seat.id = bs.seat_id
         WHERE b.user_id = $1
         GROUP BY b.id, s.id, m.id
         ORDER BY b.created_at DESC`,
        [userId]
    );
    return result.rows;
}

async function attachStripeSession(bookingId, sessionId) {
    await query(
        `UPDATE bookings SET stripe_checkout_session_id = $2, updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [bookingId, sessionId]
    );
}

async function confirmBooking({ bookingId, provider, providerReference }) {
    await withTransaction(async (client) => {
        const bookingResult = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
        const booking = bookingResult.rows[0];
        if (!booking) throw httpError(404, "Booking not found.");
        if (booking.status === "confirmed") return;
        if (booking.status !== "pending") throw httpError(409, `Booking cannot be confirmed from status ${booking.status}.`);
        if (new Date(booking.expires_at) < new Date()) throw httpError(409, "The seat hold has expired.");

        await client.query(
            `INSERT INTO payments (booking_id, provider, provider_reference, amount_cents, status)
             VALUES ($1,$2,$3,$4,'succeeded')
             ON CONFLICT (booking_id) DO UPDATE SET
                provider = EXCLUDED.provider,
                provider_reference = EXCLUDED.provider_reference,
                amount_cents = EXCLUDED.amount_cents,
                status = 'succeeded'`,
            [booking.id, provider, providerReference, booking.total_cents]
        );
        await client.query(
            `UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
            [booking.id]
        );
        await client.query(
            `UPDATE showtime_seats SET status = 'booked', held_until = NULL
             WHERE booking_id = $1`,
            [booking.id]
        );

        const seats = await client.query("SELECT seat_id FROM booking_seats WHERE booking_id = $1", [booking.id]);
        for (const seat of seats.rows) {
            await client.query(
                `INSERT INTO tickets (booking_id, seat_id, code)
                 VALUES ($1,$2,$3)
                 ON CONFLICT (booking_id, seat_id) DO NOTHING`,
                [booking.id, seat.seat_id, reference("TKT")]
            );
        }
    });
    return getBookingById(bookingId);
}

async function failBooking({ bookingId, provider, providerReference }) {
    await withTransaction(async (client) => {
        const result = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
        const booking = result.rows[0];
        if (!booking) throw httpError(404, "Booking not found.");
        if (booking.status === "confirmed") throw httpError(409, "A confirmed booking cannot be failed.");

        await client.query(
            `INSERT INTO payments (booking_id, provider, provider_reference, amount_cents, status)
             VALUES ($1,$2,$3,$4,'failed')
             ON CONFLICT (booking_id) DO UPDATE SET status = 'failed', provider_reference = EXCLUDED.provider_reference`,
            [booking.id, provider, providerReference, booking.total_cents]
        );
        await client.query("UPDATE bookings SET status = 'payment_failed', updated_at = NOW() WHERE id = $1", [booking.id]);
        await client.query(
            `UPDATE showtime_seats SET status = 'available', booking_id = NULL, held_until = NULL
             WHERE booking_id = $1 AND status = 'held'`,
            [booking.id]
        );
    });
    return getBookingById(bookingId);
}

async function cancelBooking(bookingId) {
    await withTransaction(async (client) => {
        const result = await client.query("SELECT status FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
        if (!result.rows[0]) throw httpError(404, "Booking not found.");
        await client.query("UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [bookingId]);
        await client.query("UPDATE tickets SET status = 'cancelled' WHERE booking_id = $1", [bookingId]);
        await client.query(
            `UPDATE showtime_seats SET status = 'available', booking_id = NULL, held_until = NULL WHERE booking_id = $1`,
            [bookingId]
        );
    });
    return getBookingById(bookingId);
}

module.exports = {
    httpError,
    quoteBooking,
    createBooking,
    getBookingById,
    getUserBookings,
    attachStripeSession,
    confirmBooking,
    failBooking,
    cancelBooking
};
