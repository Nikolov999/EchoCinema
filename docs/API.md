# API overview

## Public

```text
GET  /api/health
GET  /api/config
GET  /api/movies?q=
GET  /api/movies/:slug
GET  /api/showtimes/:id
GET  /api/showtimes/:id/seats
POST /api/bookings/quote
```

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Customer bookings and payments

```text
POST /api/bookings
GET  /api/bookings/my
GET  /api/bookings/:id
POST /api/payments/create-checkout-session
POST /api/payments/demo
GET  /api/payments/session/:sessionId
POST /api/payments/webhook
```

## Administrator

```text
GET   /api/admin/summary
POST  /api/admin/movies
PATCH /api/admin/movies/:id
POST  /api/admin/showtimes
PATCH /api/admin/bookings/:id/status
```
