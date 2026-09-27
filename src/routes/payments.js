"use strict";

const express = require("express");
const { config } = require("../config");
const { requireAuth } = require("../middleware/auth");
const { cleanString, isUuid } = require("../utils/validation");
const bookingService = require("../services/booking-service");
const stripeService = require("../services/stripe-service");
const serialize = require("../utils/serialize");

const router = express.Router();

router.post("/create-checkout-session", requireAuth, async (req, res, next) => {
    try {
        const bookingId = req.body?.bookingId;
        if (!isUuid(bookingId)) return res.status(400).json({ error: "Invalid booking ID." });
        const booking = await bookingService.getBookingById(bookingId, req.session.user.id);
        if (booking.status !== "pending") return res.status(409).json({ error: "Only pending bookings can enter checkout." });

        if (config.paymentMode === "demo") {
            return res.json({ mode: "demo", booking: serialize.booking(booking) });
        }

        const session = await stripeService.createCheckoutSession(booking);
        await bookingService.attachStripeSession(booking.id, session.id);
        res.json({ mode: "stripe", url: session.url, sessionId: session.id });
    } catch (error) {
        next(error);
    }
});

router.post("/demo", requireAuth, async (req, res, next) => {
    try {
        if (config.paymentMode !== "demo") return res.status(404).json({ error: "Demo payment is disabled." });
        const bookingId = req.body?.bookingId;
        if (!isUuid(bookingId)) return res.status(400).json({ error: "Invalid booking ID." });
        const cardNumber = cleanString(req.body?.cardNumber, 30).replace(/\D/g, "");
        const booking = await bookingService.getBookingById(bookingId, req.session.user.id);
        if (booking.status !== "pending") return res.status(409).json({ error: "Booking is not pending." });

        if (cardNumber === "4111111111110000") {
            const failed = await bookingService.failBooking({
                bookingId,
                provider: "demo",
                providerReference: "demo-declined"
            });
            return res.status(402).json({ error: "Payment declined by the demonstration gateway.", booking: serialize.booking(failed) });
        }
        if (cardNumber !== "4242424242424242") {
            return res.status(400).json({ error: "Use an approved or declined demonstration card number." });
        }

        const confirmed = await bookingService.confirmBooking({
            bookingId,
            provider: "demo",
            providerReference: "demo-approved"
        });
        res.json({ booking: serialize.booking(confirmed) });
    } catch (error) {
        next(error);
    }
});

router.get("/session/:sessionId", requireAuth, async (req, res, next) => {
    try {
        if (config.paymentMode !== "stripe") return res.status(404).json({ error: "Stripe payment is disabled." });
        const session = await stripeService.retrieveSession(req.params.sessionId);
        const bookingId = session.metadata?.bookingId;
        if (!isUuid(bookingId)) return res.status(400).json({ error: "Stripe session is missing booking metadata." });
        await bookingService.getBookingById(bookingId, req.session.user.id);

        let booking;
        if (session.payment_status === "paid") {
            booking = await bookingService.confirmBooking({
                bookingId,
                provider: "stripe",
                providerReference: session.payment_intent || session.id
            });
        } else {
            booking = await bookingService.getBookingById(bookingId, req.session.user.id);
        }
        res.json({ paymentStatus: session.payment_status, booking: serialize.booking(booking) });
    } catch (error) {
        next(error);
    }
});

async function webhookHandler(req, res) {
    try {
        const signature = req.get("stripe-signature");
        const event = stripeService.constructWebhookEvent(req.body, signature);
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const bookingId = session.metadata?.bookingId;
            if (isUuid(bookingId) && session.payment_status === "paid") {
                await bookingService.confirmBooking({
                    bookingId,
                    provider: "stripe",
                    providerReference: session.payment_intent || session.id
                });
            }
        }
        res.json({ received: true });
    } catch (error) {
        console.error("Stripe webhook error", error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
}

module.exports = { router, webhookHandler };
