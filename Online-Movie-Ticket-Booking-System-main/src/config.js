"use strict";

function integerFromEnv(name, fallback) {
    const value = Number.parseInt(process.env[name] || "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

const nodeEnv = process.env.NODE_ENV || "development";
const port = integerFromEnv("PORT", 3000);
const renderUrl = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : "";
const appUrl = (process.env.APP_URL || renderUrl || `http://localhost:${port}`).replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL || "";
const paymentMode = (process.env.PAYMENT_MODE || "demo").toLowerCase();

if (!databaseUrl) {
    console.warn("DATABASE_URL is not set. Database-backed routes will fail until it is configured.");
}

if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET is not set. A development-only fallback is being used.");
}

if (!["demo", "stripe"].includes(paymentMode)) {
    throw new Error("PAYMENT_MODE must be either 'demo' or 'stripe'.");
}

if (paymentMode === "stripe" && !process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required when PAYMENT_MODE=stripe.");
}

const config = Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === "production",
    port,
    appUrl,
    databaseUrl,
    sessionSecret: process.env.SESSION_SECRET || "development-only-change-me",
    paymentMode,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    seatHoldMinutes: integerFromEnv("SEAT_HOLD_MINUTES", 15)
});

module.exports = { config };
