"use strict";

function movie(row) {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        genre: row.genre,
        keywords: row.keywords,
        duration: row.duration_minutes,
        rating: Number(row.rating),
        certificate: row.certificate,
        priceCents: row.base_price_cents,
        gradient: row.poster_gradient,
        active: row.active
    };
}

function showtime(row) {
    return {
        id: row.id,
        movieId: row.movie_id,
        screenId: row.screen_id,
        screenName: row.screen_name,
        startsAt: row.starts_at,
        priceCents: row.price_cents,
        status: row.status
    };
}

function booking(row) {
    return {
        id: row.id,
        reference: row.reference,
        status: row.status,
        subtotalCents: row.subtotal_cents,
        discountCents: row.discount_cents,
        totalCents: row.total_cents,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
        showtimeId: row.showtime_id,
        startsAt: row.starts_at,
        movieSlug: row.movie_slug,
        movieTitle: row.movie_title,
        screenName: row.screen_name,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        seats: Array.isArray(row.seats) ? row.seats : [],
        seatCodes: row.seat_codes || undefined
    };
}

module.exports = { movie, showtime, booking };
