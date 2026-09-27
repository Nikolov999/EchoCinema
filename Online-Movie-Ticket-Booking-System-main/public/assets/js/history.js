"use strict";

(async () => {
    const list = document.getElementById("bookingList");
    const feedback = document.getElementById("historyFeedback");
    try {
        const { user } = await EchoApi.api("/api/auth/me");
        if (!user) {
            window.location.href = `login.html?returnTo=${encodeURIComponent("/history.html")}`;
            return;
        }
        const { bookings } = await EchoApi.api("/api/bookings/my");
        if (!bookings.length) {
            list.innerHTML = '<div class="empty-state">No bookings yet. Select a movie to begin.</div>';
            return;
        }
        list.innerHTML = bookings.map((booking) => `
            <article class="panel booking-list-item">
                <div><span class="status status-${EchoApi.escapeHtml(booking.status)}">${EchoApi.escapeHtml(booking.status)}</span><h2>${EchoApi.escapeHtml(booking.movieTitle)}</h2><p class="muted">${EchoApi.escapeHtml(EchoApi.dateTime(booking.startsAt))} · Seats ${EchoApi.escapeHtml(booking.seatCodes || "")}</p></div>
                <div class="booking-list-side"><strong>${EchoApi.money(booking.totalCents)}</strong><span>${EchoApi.escapeHtml(booking.reference)}</span>${booking.status === "confirmed" ? `<a class="button secondary" href="success.html?booking=${encodeURIComponent(booking.id)}">View tickets</a>` : ""}</div>
            </article>`).join("");
    } catch (error) {
        feedback.textContent = error.message;
        feedback.className = "feedback error";
    }
})();
