"use strict";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
const bookingId = params.get("booking");

function renderBooking(booking) {
    const confirmation = document.getElementById("confirmation");
    confirmation.querySelector("h1").textContent = booking.status === "confirmed" ? "Booking confirmed" : `Booking ${booking.status}`;
    document.getElementById("successFeedback").textContent = booking.status === "confirmed"
        ? "Payment was verified and electronic tickets were generated."
        : "The booking has not yet reached confirmed status.";
    document.getElementById("confirmationDetails").innerHTML = `
        <div class="summary-row"><span>Booking reference</span><strong>${EchoApi.escapeHtml(booking.reference)}</strong></div>
        <div class="summary-row"><span>Movie</span><strong>${EchoApi.escapeHtml(booking.movieTitle)}</strong></div>
        <div class="summary-row"><span>Showtime</span><strong>${EchoApi.escapeHtml(EchoApi.dateTime(booking.startsAt))}</strong></div>
        <div class="summary-row"><span>Screen</span><strong>${EchoApi.escapeHtml(booking.screenName)}</strong></div>
        <div class="summary-row"><span>Seats</span><strong>${booking.seats.map((seat) => EchoApi.escapeHtml(seat.seatCode)).join(", ")}</strong></div>
        <div class="summary-row total"><span>Total</span><strong>${EchoApi.money(booking.totalCents)}</strong></div>`;
    const tickets = booking.seats.filter((seat) => seat.ticketCode);
    if (tickets.length) {
        document.getElementById("ticketHeading").classList.remove("hidden");
        document.getElementById("ticketList").innerHTML = tickets.map((seat) => `<div class="ticket"><span>Seat ${EchoApi.escapeHtml(seat.seatCode)}</span><strong>${EchoApi.escapeHtml(seat.ticketCode)}</strong></div>`).join("");
    }
}

async function waitForStripe() {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const { booking, paymentStatus } = await EchoApi.api(`/api/payments/session/${encodeURIComponent(sessionId)}`);
        if (booking.status === "confirmed" || paymentStatus === "paid") return booking;
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Payment is still processing. Open My bookings shortly to check the result.");
}

(async () => {
    try {
        const { user } = await EchoApi.api("/api/auth/me");
        if (!user) {
            window.location.href = `login.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return;
        }
        let booking;
        if (sessionId) booking = await waitForStripe();
        else if (bookingId) ({ booking } = await EchoApi.api(`/api/bookings/${encodeURIComponent(bookingId)}`));
        else throw new Error("No booking or Stripe session was supplied.");
        renderBooking(booking);
    } catch (error) {
        document.getElementById("successFeedback").textContent = error.message;
        document.getElementById("successFeedback").className = "feedback error";
    }
})();
