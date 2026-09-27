"use strict";

const express = require("express");
const { query } = require("../db/pool");
const { cleanString, isUuid } = require("../utils/validation");
const serialize = require("../utils/serialize");

const router = express.Router();

router.get("/movies", async (req, res, next) => {
    try {
        const search = cleanString(req.query.q, 80).toLowerCase();
        const params = [];
        let where = "WHERE active = TRUE";
        if (search) {
            params.push(`%${search}%`);
            where += ` AND LOWER(title || ' ' || genre || ' ' || keywords) LIKE $1`;
        }
        const result = await query(
            `SELECT * FROM movies ${where} ORDER BY title`,
            params
        );
        res.json({ movies: result.rows.map(serialize.movie) });
    } catch (error) {
        next(error);
    }
});

router.get("/movies/:slug", async (req, res, next) => {
    try {
        const movieResult = await query(
            "SELECT * FROM movies WHERE slug = $1 AND active = TRUE",
            [cleanString(req.params.slug, 120)]
        );
        if (!movieResult.rows[0]) return res.status(404).json({ error: "Movie not found." });

        const showtimeResult = await query(
            `SELECT s.*, sc.name AS screen_name
             FROM showtimes s
             JOIN screens sc ON sc.id = s.screen_id
             WHERE s.movie_id = $1 AND s.status = 'scheduled' AND s.starts_at > NOW()
             ORDER BY s.starts_at`,
            [movieResult.rows[0].id]
        );
        res.json({
            movie: serialize.movie(movieResult.rows[0]),
            showtimes: showtimeResult.rows.map(serialize.showtime)
        });
    } catch (error) {
        next(error);
    }
});

router.get("/showtimes/:id", async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid showtime ID." });
        const result = await query(
            `SELECT s.*, sc.name AS screen_name,
                    m.slug AS movie_slug, m.title AS movie_title, m.genre, m.certificate, m.poster_gradient
             FROM showtimes s
             JOIN screens sc ON sc.id = s.screen_id
             JOIN movies m ON m.id = s.movie_id
             WHERE s.id = $1`,
            [req.params.id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: "Showtime not found." });
        const row = result.rows[0];
        res.json({
            showtime: {
                ...serialize.showtime(row),
                movieSlug: row.movie_slug,
                movieTitle: row.movie_title,
                genre: row.genre,
                certificate: row.certificate,
                gradient: row.poster_gradient
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get("/showtimes/:id/seats", async (req, res, next) => {
    try {
        if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid showtime ID." });
        await query(
            `UPDATE showtime_seats ss
             SET status = 'available', booking_id = NULL, held_until = NULL
             FROM bookings b
             WHERE ss.booking_id = b.id AND b.status = 'pending' AND b.expires_at < NOW()`
        );
        await query("UPDATE bookings SET status = 'expired', updated_at = NOW() WHERE status = 'pending' AND expires_at < NOW()");

        const result = await query(
            `SELECT seat.id, seat.seat_code, seat.row_label, seat.seat_number,
                    CASE
                        WHEN ss.status = 'held' AND ss.held_until < NOW() THEN 'available'
                        ELSE ss.status
                    END AS status
             FROM showtime_seats ss
             JOIN seats seat ON seat.id = ss.seat_id
             WHERE ss.showtime_id = $1
             ORDER BY seat.row_label, seat.seat_number`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: "Seat map not found." });
        res.json({
            seats: result.rows.map((row) => ({
                id: row.id,
                code: row.seat_code,
                row: row.row_label,
                number: row.seat_number,
                status: row.status
            }))
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
