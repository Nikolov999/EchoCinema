"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { validateSeatCodes, cleanString, isUuid } = require("../utils/validation");
const service = require("../services/booking-service");
const serialize = require("../utils/serialize");

const router = express.Router();

function bookingInput(req, res) {
    const showtimeId = req.body?.showtimeId;
    const seatCodes = validateSeatCodes(req.body?.seatCodes);
    const promoCode = cleanString(req.body?.promoCode, 30).toUpperCase();
    if (!isUuid(showtimeId)) {
        res.status(400).json({ error: "A valid showtime is required." });
        return null;
    }
    if (!seatCodes.length) {
        res.status(400).json({ error: "Select at least one valid seat." });
        return null;
    }
    return { showtimeId, seatCodes, promoCode };
}

router.post("/bookings/quote", async (req, res, next) => {
    try {
        const input = bookingInput(req, res);
        if (!input) return;
        const quote = await service.quoteBooking(input);
        res.json({
            quote: {
                movieTitle: quote.showtime.title,
                startsAt: quote.showtime.starts_at,
                screenName: quote.showtime.screen_name,
                seats: quote.seats.map((seat) => seat.seat_code),
                promoCode: quote.promo?.code || null,
                percentageOff: quote.promo?.percentage_off || 0,
                subtotalCents: quote.subtotalCents,
                discountCents: quote.discountCents,
                totalCents: quote.totalCents
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post("/bookings", requireAuth, async (req, res, next) => {
    try {
        const input = bookingInput(req, res);
        if (!input) return;
        const booking = await service.createBooking({ userId: req.session.user.id, ...input });
        res.status(201).json({ booking: serialize.booking(booking) });
    } catch (error) {
        next(error);
    }
});

router.get("/bookings/my", requireAuth, async (req, res, next) => {
    try {
        const rows = await service.getUserBookings(req.session.user.id);
        res.json({ bookings: rows.map(serialize.booking) });
    } catch (error) {
        next(error);
    }
});

router.get("/bookings/:id", requireAuth, async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid booking ID." });
        const booking = await service.getBookingById(
            req.params.id,
            req.session.user.id,
            req.session.user.role === "admin"
        );
        res.json({ booking: serialize.booking(booking) });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
