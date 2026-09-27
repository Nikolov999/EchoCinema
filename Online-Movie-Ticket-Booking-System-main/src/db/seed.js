"use strict";

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { pool, withTransaction } = require("./pool");

const MOVIES = [
    {
        slug: "interstellar",
        title: "Interstellar",
        genre: "Science Fiction / Drama",
        keywords: "space exploration future family",
        duration: 169,
        rating: 8.7,
        certificate: "12A",
        priceCents: 1250,
        description: "A team of explorers travels through a wormhole while searching for a future home for humanity.",
        gradient: "linear-gradient(135deg, #172554 0%, #1e3a8a 45%, #c2410c 100%)"
    },
    {
        slug: "dark-knight",
        title: "The Dark Knight",
        genre: "Action / Crime",
        keywords: "superhero gotham crime thriller",
        duration: 152,
        rating: 9.0,
        certificate: "15",
        priceCents: 1250,
        description: "A masked vigilante faces a criminal mastermind who pushes Gotham City into chaos.",
        gradient: "linear-gradient(135deg, #111827 0%, #374151 52%, #7f1d1d 100%)"
    },
    {
        slug: "inception",
        title: "Inception",
        genre: "Science Fiction / Action",
        keywords: "dream heist thriller mind",
        duration: 148,
        rating: 8.8,
        certificate: "12A",
        priceCents: 1300,
        description: "A specialist thief enters dreams to steal secrets and attempts the more dangerous task of planting an idea.",
        gradient: "linear-gradient(135deg, #164e63 0%, #0f766e 48%, #ca8a04 100%)"
    },
    {
        slug: "dune-part-two",
        title: "Dune: Part Two",
        genre: "Science Fiction / Adventure",
        keywords: "desert empire war adventure",
        duration: 166,
        rating: 8.5,
        certificate: "12A",
        priceCents: 1400,
        description: "Paul Atreides unites with the Fremen while confronting the forces that destroyed his family.",
        gradient: "linear-gradient(135deg, #451a03 0%, #b45309 46%, #fde68a 100%)"
    }
];

function futureDate(dayOffset, hour, minute = 0) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + dayOffset);
    date.setUTCHours(hour, minute, 0, 0);
    return date;
}

async function seed() {
    await withTransaction(async (client) => {
        const studentHash = await bcrypt.hash("Student123!", 12);
        const adminHash = await bcrypt.hash("Admin123!", 12);

        await client.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'customer')
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
            ["Demo Student", "student@example.com", studentHash]
        );
        await client.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'admin')
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'admin'`,
            ["Cinema Administrator", "admin@example.com", adminHash]
        );

        const screenResult = await client.query(
            `INSERT INTO screens (name, row_count, seats_per_row)
             VALUES ('Screen 1', 4, 8)
             ON CONFLICT (name) DO UPDATE SET row_count = 4, seats_per_row = 8
             RETURNING id`
        );
        const screenId = screenResult.rows[0].id;

        for (const rowLabel of ["A", "B", "C", "D"]) {
            for (let seatNumber = 1; seatNumber <= 8; seatNumber += 1) {
                const seatCode = `${rowLabel}${seatNumber}`;
                await client.query(
                    `INSERT INTO seats (screen_id, row_label, seat_number, seat_code)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (screen_id, seat_code) DO NOTHING`,
                    [screenId, rowLabel, seatNumber, seatCode]
                );
            }
        }

        const movieIds = new Map();
        for (const movie of MOVIES) {
            const result = await client.query(
                `INSERT INTO movies
                    (slug, title, description, genre, keywords, duration_minutes, rating, certificate, base_price_cents, poster_gradient)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 ON CONFLICT (slug) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    genre = EXCLUDED.genre,
                    keywords = EXCLUDED.keywords,
                    duration_minutes = EXCLUDED.duration_minutes,
                    rating = EXCLUDED.rating,
                    certificate = EXCLUDED.certificate,
                    base_price_cents = EXCLUDED.base_price_cents,
                    poster_gradient = EXCLUDED.poster_gradient,
                    active = TRUE
                 RETURNING id`,
                [movie.slug, movie.title, movie.description, movie.genre, movie.keywords, movie.duration, movie.rating, movie.certificate, movie.priceCents, movie.gradient]
            );
            movieIds.set(movie.slug, result.rows[0].id);
        }

        const schedule = [
            ["interstellar", 1, 14, 0],
            ["dark-knight", 1, 17, 0],
            ["inception", 1, 20, 15],
            ["dune-part-two", 2, 13, 30],
            ["interstellar", 2, 17, 30],
            ["dark-knight", 2, 20, 45],
            ["inception", 3, 15, 0],
            ["dune-part-two", 3, 19, 30]
        ];

        for (const [slug, dayOffset, hour, minute] of schedule) {
            const movie = MOVIES.find((item) => item.slug === slug);
            const showtimeResult = await client.query(
                `INSERT INTO showtimes (movie_id, screen_id, starts_at, price_cents)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (screen_id, starts_at) DO UPDATE SET
                    movie_id = EXCLUDED.movie_id,
                    price_cents = EXCLUDED.price_cents,
                    status = 'scheduled'
                 RETURNING id`,
                [movieIds.get(slug), screenId, futureDate(dayOffset, hour, minute), movie.priceCents]
            );
            await client.query(
                `INSERT INTO showtime_seats (showtime_id, seat_id)
                 SELECT $1, id FROM seats WHERE screen_id = $2
                 ON CONFLICT (showtime_id, seat_id) DO NOTHING`,
                [showtimeResult.rows[0].id, screenId]
            );
        }

        await client.query(
            `INSERT INTO promo_codes (code, percentage_off, active)
             VALUES ('SAVE10', 10, TRUE)
             ON CONFLICT (code) DO UPDATE SET percentage_off = 10, active = TRUE`
        );
    });

    console.log("Seed data applied.");
    console.log("Customer: student@example.com / Student123!");
    console.log("Admin: admin@example.com / Admin123!");
}

seed()
    .catch((error) => {
        console.error("Database seed failed:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
