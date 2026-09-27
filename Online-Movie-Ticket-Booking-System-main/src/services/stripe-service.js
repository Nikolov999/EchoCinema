"use strict";

const Stripe = require("stripe");
const { config } = require("../config");

const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

function requireStripe() {
    if (!stripe) {
        const error = new Error("Stripe is not configured.");
        error.status = 503;
        throw error;
    }
    return stripe;
}

async function createCheckoutSession(booking) {
    const client = requireStripe();
    return client.checkout.sessions.create({
        mode: "payment",
        client_reference_id: booking.reference,
        customer_email: booking.customer_email,
        metadata: {
            bookingId: booking.id,
            bookingReference: booking.reference
        },
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: "eur",
                    unit_amount: booking.total_cents,
                    product_data: {
                        name: `${booking.movie_title} — ${booking.seats.map((seat) => seat.seatCode).join(", ")}`,
                        description: new Date(booking.starts_at).toLocaleString("en-IE")
                    }
                }
            }
        ],
        success_url: `${config.appUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.appUrl}/payment.html?booking=${encodeURIComponent(booking.id)}&cancelled=1`
    });
}

function constructWebhookEvent(rawBody, signature) {
    if (!config.stripeWebhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    }
    return requireStripe().webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}

async function retrieveSession(sessionId) {
    return requireStripe().checkout.sessions.retrieve(sessionId);
}

module.exports = { createCheckoutSession, constructWebhookEvent, retrieveSession };
