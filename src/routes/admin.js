"use strict";

const express = require("express");
const { query } = require("../db/pool");
const { requireAdmin } = require("../middleware/auth");
const { cleanString, isUuid, parsePositiveInteger } = require("../utils/validation");
const bookingService = require("../services/booking-service");
const serialize = require("../utils/serialize");

const router = express.Router();
router.use(requireAdmin);

router.get("/summary", async (req, res, next) => {
    try {
        const [counts, movies, screens, showtimes, bookings] = await Promise.all([
            query(`SELECT
                    (SELECT COUNT(*)::int FROM users) AS users,
                    (SELECT COUNT(*)::int FROM movies WHERE active = TRUE) AS movies,
                    (SELECT COUNT(*)::int FROM showtimes WHERE starts_at > NOW() AND status = 'scheduled') AS showtimes,
                    (SELECT COUNT(*)::int FROM bookings) AS bookings`),
            query("SELECT * FROM movies ORDER BY title"),
            query("SELECT * FROM screens ORDER BY name"),
            query(`SELECT s.*, sc.name AS screen_name, m.title AS movie_title
                   FROM showtimes s
                   JOIN screens sc ON sc.id = s.screen_id
                   JOIN movies m ON m.id = s.movie_id
                   WHERE s.starts_at > NOW()
                   ORDER BY s.starts_at
                   LIMIT 30`),
            query(`SELECT b.id, b.reference, b.status, b.total_cents, b.created_at,
                          s.starts_at, m.title AS movie_title, u.name AS customer_name,
                          string_agg(seat.seat_code, ', ' ORDER BY seat.row_label, seat.seat_number) AS seat_codes
                   FROM bookings b
                   JOIN users u ON u.id = b.user_id
                   JOIN showtimes s ON s.id = b.showtime_id
                   JOIN movies m ON m.id = s.movie_id
                   LEFT JOIN booking_seats bs ON bs.booking_id = b.id
                   LEFT JOIN seats seat ON seat.id = bs.seat_id
                   GROUP BY b.id, s.id, m.id, u.id
                   ORDER BY b.created_at DESC
                   LIMIT 30`)
        ]);

        res.json({
            counts: counts.rows[0],
            movies: movies.rows.map(serialize.movie),
            screens: screens.rows,
            showtimes: showtimes.rows.map((row) => ({
                ...serialize.showtime(row),
                movieTitle: row.movie_title
            })),
            bookings: bookings.rows.map((row) => ({
                id: row.id,
                reference: row.reference,
                status: row.status,
                totalCents: row.total_cents,
                createdAt: row.created_at,
                startsAt: row.starts_at,
                movieTitle: row.movie_title,
                customerName: row.customer_name,
                seatCodes: row.seat_codes
            }))
        });
    } catch (error) {
        next(error);
    }
});

router.post("/movies", async (req, res, next) => {
    try {
        const value = {
            slug: cleanString(req.body?.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
            title: cleanString(req.body?.title, 160),
            description: cleanString(req.body?.description, 2000),
            genre: cleanString(req.body?.genre, 160),
            keywords: cleanString(req.body?.keywords, 500),
            duration: parsePositiveInteger(req.body?.duration),
            rating: Number.parseFloat(req.body?.rating),
            certificate: cleanString(req.body?.certificate, 20),
            priceCents: Math.round(Number.parseFloat(req.body?.price) * 100),
            gradient: cleanString(req.body?.gradient, 500) || "linear-gradient(135deg, #172554, #c2410c)"
        };
        if (!value.slug || !value.title || !value.description || !value.genre || !value.duration || !Number.isFinite(value.rating) || !value.certificate || !Number.isInteger(value.priceCents) || value.priceCents < 0) {
            return res.status(400).json({ error: "Complete all required movie fields with valid values." });
        }

        const result = await query(
            `INSERT INTO movies
                (slug,title,description,genre,keywords,duration_minutes,rating,certificate,base_price_cents,poster_gradient)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING *`,
            [value.slug, value.title, value.description, value.genre, value.keywords, value.duration, value.rating, value.certificate, value.priceCents, value.gradient]
        );
        res.status(201).json({ movie: serialize.movie(result.rows[0]) });
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ error: "That movie slug already exists." });
        next(error);
    }
});

router.patch("/movies/:id", async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid movie ID." });
        const active = req.body?.active;
        if (typeof active !== "boolean") return res.status(400).json({ error: "The active value must be true or false." });
        const result = await query("UPDATE movies SET active = $2 WHERE id = $1 RETURNING *", [req.params.id, active]);
        if (!result.rows[0]) return res.status(404).json({ error: "Movie not found." });
        res.json({ movie: serialize.movie(result.rows[0]) });
    } catch (error) {
        next(error);
    }
});

router.post("/showtimes", async (req, res, next) => {
    try {
        const movieId = req.body?.movieId;
        const screenId = req.body?.screenId;
        const startsAt = new Date(req.body?.startsAt);
        const priceCents = Math.round(Number.parseFloat(req.body?.price) * 100);
        if (!isUuid(movieId) || !isUuid(screenId) || Number.isNaN(startsAt.getTime()) || startsAt <= new Date() || !Number.isInteger(priceCents) || priceCents < 0) {
            return res.status(400).json({ error: "Movie, screen, future start time, and valid price are required." });
        }
        const result = await query(
            `INSERT INTO showtimes (movie_id, screen_id, starts_at, price_cents)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [movieId, screenId, startsAt, priceCents]
        );
        await query(
            `INSERT INTO showtime_seats (showtime_id, seat_id)
             SELECT $1, id FROM seats WHERE screen_id = $2`,
            [result.rows[0].id, screenId]
        );
        res.status(201).json({ showtime: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ error: "That screen already has a showtime at this time." });
        next(error);
    }
});

router.patch("/bookings/:id/status", async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid booking ID." });
        const status = cleanString(req.body?.status, 30);
        if (status !== "cancelled") return res.status(400).json({ error: "The supported administrator action is cancellation." });
        const booking = await bookingService.cancelBooking(req.params.id);
        res.json({ booking: serialize.booking(booking) });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
