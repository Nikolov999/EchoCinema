# Echo Cinema — Online Movie Ticket Booking System

Full-stack extension of the original HTML, CSS, and JavaScript Sprint 1 prototype for Software Engineering CA2.

## Student

- Bobo Nikolov
- Student ID: 24109479
- Module: Software Engineering (H6SWE)

## What is implemented

- Existing prototype design retained and moved into `public/`
- Node.js and Express backend
- PostgreSQL database schema and seed data
- Registration, login, logout, sessions, customer/admin roles
- Database-driven movie catalogue, search, details, showtimes, and seat maps
- Transactional seat holds with expiry
- Server-side pricing and promo-code validation
- Permanent bookings, payments, tickets, and booking history
- Demo payment gateway for local/assessment testing
- Stripe Checkout and verified webhook support
- Admin dashboard for movies, showtimes, bookings, and cancellation
- Render Blueprint and deployment documentation
- Node built-in unit tests

## Architecture

```text
Browser: HTML + CSS + Vanilla JavaScript
                |
                | HTTPS / JSON
                v
Node.js + Express API
        |               |
        v               v
PostgreSQL          Stripe Checkout
```

The browser never receives the PostgreSQL connection string, Stripe secret key, password hashes, or raw payment-card data.

## Project structure

```text
public/                 Frontend pages and assets
src/app.js              Express application configuration
src/routes/             API route modules
src/services/           Booking and Stripe business logic
src/db/                 PostgreSQL pool, migration, and seed scripts
database/schema.sql     Relational database schema
tests/                  Unit tests
render.yaml             Render Blueprint
```

## Local setup

### Requirements

- Node.js 20 or newer
- PostgreSQL

### Commands

```bash
cp .env.example .env
npm install
npm run db:setup
npm test
npm start
```

Open `http://localhost:3000`.

### Demonstration accounts

```text
Customer: student@example.com / Student123!
Admin:    admin@example.com / Admin123!
```

Change these passwords before using the project outside assessment/demo environments.

## Payment modes

### Demo mode

Set:

```env
PAYMENT_MODE=demo
```

Use:

```text
Promo: SAVE10
Approved card: 4242 4242 4242 4242
Declined card: 4111 1111 1111 0000
Expiry: 12/29
Security code: 123
```

No card data is transmitted or stored in demo mode. Only the approved/declined number is compared by the server.

### Stripe mode

Set:

```env
PAYMENT_MODE=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Configure the Stripe webhook endpoint:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/payments/webhook
```

Subscribe to:

```text
checkout.session.completed
```

The booking is confirmed only after Stripe reports a paid Checkout Session through the webhook or the verified server-side session lookup.

## Database commands

```bash
npm run db:migrate
npm run db:seed
npm run db:setup
```

`db:setup` applies the schema and demonstration data. The seed script is designed for coursework and demo deployments.

## Render deployment

Detailed manual steps are in [`docs/RENDER_SETUP.md`](docs/RENDER_SETUP.md).

The included `render.yaml` can create:

- One Node web service
- One PostgreSQL database
- Database connection environment variable
- Generated session secret
- Automatic migration and seed execution

The Blueprint defaults to `PAYMENT_MODE=demo`. Switch to Stripe only after adding the Stripe secrets and webhook.

## Testing

```bash
npm test
npm run check
```

The included tests cover pricing, discounts, registration validation, login validation, seat-code handling, and UUID validation. Database integration and end-to-end cases should be added during the final testing checkpoint.

## Security decisions

- Passwords are hashed with bcryptjs.
- SQL values use parameterized node-postgres queries.
- Booking creation and payment fulfilment use PostgreSQL transactions.
- Session cookies are HTTP-only, same-site, and secure in production.
- Helmet security headers and API rate limiting are enabled.
- Mutating browser requests are restricted to the configured application origin.
- Prices and promo discounts are recalculated by the server.
- Stripe secret and webhook keys are read only from environment variables.
- Full card numbers and security codes are never stored.
