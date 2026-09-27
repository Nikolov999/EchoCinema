"use strict";

const { config } = require("../config");

function requireSameOrigin(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.path === "/api/payments/webhook") return next();

    const origin = req.get("origin");
    if (!origin) return next();

    try {
        const expected = new URL(config.appUrl).origin;
        if (new URL(origin).origin !== expected) {
            return res.status(403).json({ error: "Cross-origin request rejected." });
        }
    } catch {
        return res.status(403).json({ error: "Invalid request origin." });
    }
    next();
}

module.exports = { requireSameOrigin };
