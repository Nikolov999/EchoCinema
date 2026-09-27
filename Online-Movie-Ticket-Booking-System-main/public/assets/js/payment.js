"use strict";

const params = new URLSearchParams(window.location.search);
const showtimeId = params.get("showtime");
const seatCodes = (params.get("seats") || "").split(",").map((seat) => seat.trim()).filter(Boolean);
let bookingId = params.get("booking");
let promoCode = "";
let paymentMode = "demo";
let currentUser;
let currentQuote;

const paymentFeedback = document.getElementById("paymentFeedback");
const promoFeedback = document.getElementById("promoFeedback");
const payButton = document.getElementById("payButton");

function showFeedback(element, message, type = "error") {
    element.textContent = message;
    element.className = `feedback ${type}`;
}

function renderSummary(summary) {
    document.getElementById("movieName").textContent = summary.movieTitle;
    document.getElementById("showtimeText").textContent = EchoApi.dateTime(summary.startsAt);
    const codes = summary.seats.map ? summary.seats.map((seat) => seat.seatCode || seat).filter(Boolean) : [];
    document.getElementById("selectedSeatText").textContent = codes.join(", ");
    document.getElementById("subtotalText").textContent = EchoApi.money(summary.subtotalCents);
    document.getElementById("discountText").textContent = `-${EchoApi.money(summary.discountCents)}`;
    document.getElementById("totalText").textContent = EchoApi.money(summary.totalCents);
}

async function loadQuote() {
    const { quote } = await EchoApi.api("/api/bookings/quote", {
        method: "POST",
        body: { showtimeId, seatCodes, promoCode }
    });
    currentQuote = quote;
    renderSummary(quote);
}

async function loadExistingBooking() {
    const { booking } = await EchoApi.api(`/api/bookings/${encodeURIComponent(bookingId)}`);
    currentQuote = booking;
    renderSummary(booking);
    document.getElementById("promoArea").classList.add("hidden");
    if (booking.status !== "pending") {
        payButton.disabled = true;
        showFeedback(paymentFeedback, `This booking is ${booking.status}.`, "error");
    }
}

async function ensureBooking() {
    if (bookingId) return bookingId;
    const { booking } = await EchoApi.api("/api/bookings", {
        method: "POST",
        body: { showtimeId, seatCodes, promoCode }
    });
    bookingId = booking.id;
    return bookingId;
}

document.getElementById("applyPromo").addEventListener("click", async () => {
    try {
        promoCode = document.getElementById("promoCode").value.trim().toUpperCase();
        await loadQuote();
        showFeedback(promoFeedback, promoCode ? "Promo code applied to the server-side quote." : "Promo code removed.", "success");
    } catch (error) {
        promoCode = "";
        showFeedback(promoFeedback, error.message, "error");
        await loadQuote().catch(() => undefined);
    }
});

document.getElementById("paymentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    paymentFeedback.textContent = "";
    payButton.disabled = true;
    try {
        const id = await ensureBooking();
        const checkout = await EchoApi.api("/api/payments/create-checkout-session", {
            method: "POST",
            body: { bookingId: id }
        });

        if (checkout.mode === "stripe") {
            window.location.href = checkout.url;
            return;
        }

        const customerName = document.getElementById("customerName").value.trim();
        const cardNumber = document.getElementById("cardNumber").value.replace(/\D/g, "");
        const expiry = document.getElementById("expiry").value.trim();
        const securityCode = document.getElementById("securityCode").value.trim();
        if (!customerName || cardNumber.length !== 16 || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3}$/.test(securityCode)) {
            throw new Error("Enter a name, 16-digit test card, MM/YY expiry, and 3-digit security code.");
        }
        await EchoApi.api("/api/payments/demo", {
            method: "POST",
            body: { bookingId: id, cardNumber }
        });
        window.location.href = `success.html?booking=${encodeURIComponent(id)}`;
    } catch (error) {
        showFeedback(paymentFeedback, error.message, "error");
        payButton.disabled = false;
    }
});

(async () => {
    try {
        const [{ user }, appConfig] = await Promise.all([
            EchoApi.api("/api/auth/me"),
            EchoApi.api("/api/config")
        ]);
        if (!user) {
            const returnTo = `${window.location.pathname}${window.location.search}`;
            window.location.href = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
            return;
        }
        currentUser = user;
        paymentMode = appConfig.paymentMode;
        document.getElementById("customerName").value = user.name;
        if (paymentMode === "demo") {
            document.getElementById("demoPaymentFields").classList.remove("hidden");
            document.getElementById("paymentModeText").textContent = "Demonstration gateway mode is active. No real card data is transmitted or stored.";
            document.getElementById("paymentHeading").textContent = "Demonstration payment";
            payButton.textContent = "Pay and confirm booking";
        } else {
            document.getElementById("paymentModeText").textContent = "Payment will continue on Stripe Checkout. Card data is entered directly on Stripe.";
            document.getElementById("paymentHeading").textContent = "Stripe Checkout";
            payButton.textContent = "Continue to Stripe Checkout";
        }

        if (params.get("cancelled")) showFeedback(paymentFeedback, "Stripe Checkout was cancelled. Your seat hold remains available until it expires.", "error");
        if (bookingId) await loadExistingBooking();
        else {
            if (!showtimeId || !seatCodes.length) throw new Error("No showtime or seats were provided.");
            await loadQuote();
        }
    } catch (error) {
        showFeedback(paymentFeedback, error.message, "error");
        payButton.disabled = true;
    }
})();
