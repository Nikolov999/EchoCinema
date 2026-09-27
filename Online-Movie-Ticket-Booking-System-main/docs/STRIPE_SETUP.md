# Stripe test-mode setup

The repository deploys in `PAYMENT_MODE=demo` by default. Complete the database-backed demo flow first, then enable Stripe.

## 1. Obtain the test secret key

In the Stripe Dashboard, switch to test mode and copy the secret test key beginning with:

```text
sk_test_
```

Add it to Render as:

```text
STRIPE_SECRET_KEY=sk_test_...
```

Never place this key in frontend JavaScript, HTML, GitHub, screenshots, or the README.

## 2. Create the webhook endpoint

In Stripe Workbench or Developers → Webhooks, add:

```text
https://YOUR-SERVICE.onrender.com/api/payments/webhook
```

Subscribe to:

```text
checkout.session.completed
```

Copy the endpoint signing secret beginning with:

```text
whsec_
```

Add it to Render as:

```text
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 3. Enable Stripe mode

Change:

```text
PAYMENT_MODE=stripe
```

Redeploy the web service.

## 4. Test

1. Log in as `student@example.com`.
2. Select a movie, showtime, and seats.
3. Continue to payment.
4. The application creates a pending booking and redirects to Stripe Checkout.
5. Use a standard Stripe test card.
6. Stripe sends `checkout.session.completed` to the webhook.
7. The backend confirms the booking, marks seats booked, records the payment, and creates tickets.

The success page also performs a server-side Checkout Session lookup. Fulfilment is idempotent, so receiving both the webhook and the lookup does not create duplicate tickets.
