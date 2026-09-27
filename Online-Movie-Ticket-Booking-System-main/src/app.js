"use strict";

const path = require("node:path");
const express = require("express");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const helmet = require("helmet");
const morgan = require("morgan");
const { rateLimit } = require("express-rate-limit");
const { config } = require("./config");
const { pool } = require("./db/pool");
const { query } = require("./db/pool");
const { requireSameOrigin } = require("./middleware/origin");
const { notFound, errorHandler } = require("./middleware/errors");
const authRoutes = require("./routes/auth");
const movieRoutes = require("./routes/movies");
const bookingRoutes = require("./routes/bookings");
const { router: paymentRoutes, webhookHandler } = require("./routes/payments");
const adminRoutes = require("./routes/admin");

function createApp() {
    const app = express();
    const publicDir = path.join(__dirname, "../public");

    if (config.isProduction) app.set("trust proxy", 1);

    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
                frameSrc: ["'self'", "https://checkout.stripe.com"],
                formAction: ["'self'", "https://checkout.stripe.com"]
            }
        }
    }));
    app.use(morgan(config.isProduction ? "combined" : "dev"));

    app.post("/api/payments/webhook", express.raw({ type: "application/json" }), webhookHandler);
    app.use(express.json({ limit: "100kb" }));
    app.use(express.urlencoded({ extended: false }));

    const PgSession = connectPgSimple(session);
    app.use(session({
        name: "echo.sid",
        store: new PgSession({ pool, createTableIfMissing: true }),
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8
        }
    }));

    app.use(requireSameOrigin);

    const apiLimiter = rateLimit({
        windowMs: 60_000,
        limit: 180,
        standardHeaders: "draft-8",
        legacyHeaders: false
    });
    const authLimiter = rateLimit({
        windowMs: 15 * 60_000,
        limit: 30,
        standardHeaders: "draft-8",
        legacyHeaders: false
    });

    app.get("/api/health", async (req, res) => {
        void req;
        try {
            await query("SELECT 1");
            res.json({ status: "ok", database: "connected", paymentMode: config.paymentMode });
        } catch (error) {
            res.status(503).json({ status: "error", database: "unavailable", error: error.message });
        }
    });
    app.get("/api/config", (req, res) => {
        void req;
        res.json({ appName: "Echo Cinema", paymentMode: config.paymentMode, seatHoldMinutes: config.seatHoldMinutes });
    });

    app.use("/api", apiLimiter);
    app.use("/api/auth", authLimiter, authRoutes);
    app.use("/api", movieRoutes);
    app.use("/api", bookingRoutes);
    app.use("/api/payments", paymentRoutes);
    app.use("/api/admin", adminRoutes);

    app.use(express.static(publicDir, { extensions: ["html"] }));
    app.get("/", (req, res) => {
        void req;
        res.sendFile(path.join(publicDir, "index.html"));
    });

    app.use(notFound);
    app.use(errorHandler);
    return app;
}

module.exports = { createApp };
