"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db/pool");
const { validateRegistration, validateLogin } = require("../utils/validation");

const router = express.Router();

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
}

router.post("/register", async (req, res, next) => {
    try {
        const validation = validateRegistration(req.body);
        if (!validation.valid) return res.status(400).json({ error: validation.errors[0], details: validation.errors });

        const { name, email, password } = validation.value;
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await query(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1,$2,$3)
             RETURNING id, name, email, role`,
            [name, email, passwordHash]
        );
        await regenerateSession(req);
        req.session.user = result.rows[0];
        res.status(201).json({ user: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
        next(error);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const validation = validateLogin(req.body);
        if (!validation.valid) return res.status(400).json({ error: validation.errors[0], details: validation.errors });

        const result = await query(
            "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
            [validation.value.email]
        );
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(validation.value.password, user.password_hash))) {
            return res.status(401).json({ error: "Email or password is incorrect." });
        }

        await regenerateSession(req);
        req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        res.json({ user: req.session.user });
    } catch (error) {
        next(error);
    }
});

router.post("/logout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie("echo.sid");
        res.status(204).end();
    });
});

router.get("/me", (req, res) => {
    res.json({ user: req.session?.user || null });
});

module.exports = router;
