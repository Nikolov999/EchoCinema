"use strict";

const showtimeId = new URLSearchParams(window.location.search).get("showtime");
const selectedSeats = new Set();
let showtime;

const seatGrid = document.getElementById("seatGrid");
const selectedSeatText = document.getElementById("selectedSeatText");
const totalText = document.getElementById("totalText");
const seatFeedback = document.getElementById("seatFeedback");

function updateSummary() {
    const codes = [...selectedSeats];
    selectedSeatText.textContent = codes.length ? codes.join(", ") : "None";
    totalText.textContent = EchoApi.money(codes.length * (showtime?.priceCents || 0));
}

function renderSeats(seats) {
    seatGrid.innerHTML = seats.map((seat) => {
        const unavailable = seat.status !== "available";
        return `<button class="seat" type="button" data-seat="${EchoApi.escapeHtml(seat.code)}" ${unavailable ? "disabled" : ""} aria-label="Seat ${EchoApi.escapeHtml(seat.code)}${unavailable ? ", unavailable" : ""}" aria-pressed="false">${EchoApi.escapeHtml(seat.code)}</button>`;
    }).join("");
}

seatGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-seat]");
    if (!button || button.disabled) return;
    const code = button.dataset.seat;
    if (selectedSeats.has(code)) {
        selectedSeats.delete(code);
        button.classList.remove("selected");
        button.setAttribute("aria-pressed", "false");
    } else {
        if (selectedSeats.size >= 10) {
            seatFeedback.textContent = "A booking can contain up to 10 seats.";
            seatFeedback.className = "feedback error";
            return;
        }
        selectedSeats.add(code);
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");
    }
    seatFeedback.textContent = "";
    seatFeedback.className = "feedback";
    updateSummary();
});

document.getElementById("continueToPayment").addEventListener("click", () => {
    if (!selectedSeats.size) {
        seatFeedback.textContent = "Select at least one available seat.";
        seatFeedback.className = "feedback error";
        return;
    }
    const seats = encodeURIComponent([...selectedSeats].join(","));
    window.location.href = `payment.html?showtime=${encodeURIComponent(showtimeId)}&seats=${seats}`;
});

(async () => {
    try {
        if (!showtimeId) throw new Error("No showtime was selected.");
        const [showtimePayload, seatPayload] = await Promise.all([
            EchoApi.api(`/api/showtimes/${encodeURIComponent(showtimeId)}`),
            EchoApi.api(`/api/showtimes/${encodeURIComponent(showtimeId)}/seats`)
        ]);
        showtime = showtimePayload.showtime;
        document.getElementById("movieName").textContent = showtime.movieTitle;
        document.getElementById("showtimeText").textContent = EchoApi.dateTime(showtime.startsAt);
        document.getElementById("screenText").textContent = showtime.screenName;
        document.getElementById("backToMovie").href = `movie.html?id=${encodeURIComponent(showtime.movieSlug)}`;
        document.title = `Select Seats | ${showtime.movieTitle}`;
        renderSeats(seatPayload.seats);
        updateSummary();
    } catch (error) {
        seatFeedback.textContent = error.message;
        seatFeedback.className = "feedback error";
        document.getElementById("continueToPayment").disabled = true;
    }
})();
