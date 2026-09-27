# Render deployment steps

## Option A — Blueprint deployment

1. Push this repository to GitHub.
2. Open Render and choose **New → Blueprint**.
3. Connect the GitHub repository.
4. Render reads `render.yaml` and proposes:
   - `echo-cinema` web service
   - `echo-cinema-db` PostgreSQL database
5. Approve the Blueprint.
6. Wait for the build, pre-deploy database setup, and start command to finish.
7. Open `/api/health`. It should report `database: connected`.

The Blueprint starts in demonstration payment mode.

## Option B — Manual deployment

### 1. Create PostgreSQL

Create a Render PostgreSQL database in Frankfurt. Copy its internal database URL.

### 2. Create the web service

Connect the GitHub repository and use:

```text
Runtime: Node
Build command: npm install && npm run db:setup
Start command: npm start
Health check path: /api/health
```

### 3. Environment variables

Add:

```text
NODE_ENV=production
DATABASE_URL=<Render internal PostgreSQL URL>
SESSION_SECRET=<long random secret>
PAYMENT_MODE=demo
SEAT_HOLD_MINUTES=15
```

Render supplies `PORT` automatically. The application also derives its public URL from `RENDER_EXTERNAL_HOSTNAME`.

### 4. Test the deployed application

Log in using:

```text
student@example.com / Student123!
```

Complete a booking with the approved demo card. Confirm that it appears in **My bookings**.

Log in as administrator:

```text
admin@example.com / Admin123!
```

Verify the administration dashboard.

## Enable Stripe after demo deployment works

1. Create or open a Stripe account in test mode.
2. Add the Render environment variables:

```text
PAYMENT_MODE=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

3. Create a Stripe webhook endpoint:

```text
https://YOUR-SERVICE.onrender.com/api/payments/webhook
```

4. Subscribe to `checkout.session.completed`.
5. Save the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.
6. Redeploy the Render service.
7. Use Stripe's standard test cards on the hosted Stripe Checkout page.

## Common deployment failures

### `DATABASE_URL is not set`

Attach the PostgreSQL database or add its connection string to the web service.

### Health check returns 503

Run the pre-deploy command or execute:

```bash
npm run db:setup
```

### Login fails after deployment

Confirm the seed command completed and inspect Render logs for database errors.

### Stripe returns to localhost

Set `APP_URL=https://YOUR-SERVICE.onrender.com`. Normally the application derives this automatically from Render.

### Webhook signature error

Use the signing secret for the exact deployed endpoint, not the Stripe secret API key.
