# Testing plan baseline

## Unit tests

- Pricing subtotal, discount, and total calculations
- Email and password validation
- Seat-code normalization and deduplication
- Booking and ticket reference format

## Integration tests to add

- Register → session created → `/api/auth/me`
- Login with valid and invalid credentials
- Movie and showtime retrieval from PostgreSQL
- Booking transaction holds all selected seats atomically
- Competing booking cannot hold the same seats
- Expired hold releases seats
- Valid and invalid promo-code behaviour
- Approved demo payment confirms booking and creates tickets
- Declined demo payment releases seats and creates no tickets
- Administrator authorization and cancellation
- Stripe webhook signature verification and idempotent fulfilment

## System tests

- Browse → search → details → showtime → seats → payment → ticket
- Booking appears in history after confirmation
- Cancelled booking shows updated status and released seats
- Admin can add a movie and showtime
- Application starts and health check passes on Render

## User acceptance tests

- Customer can complete the intended booking journey without technical knowledge
- Unavailable seats are clearly marked
- Prices remain consistent across pages
- Errors explain the required correction
- Administrator controls are hidden from and rejected for customers
