"use strict";

let adminData;
const feedback = document.getElementById("adminFeedback");

function showFeedback(message, type = "success") {
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
}

function render(data) {
    adminData = data;
    document.getElementById("adminCounts").innerHTML = Object.entries(data.counts).map(([label, value]) => `<div class="stat-card"><strong>${value}</strong><span>${EchoApi.escapeHtml(label)}</span></div>`).join("");
    document.getElementById("showtimeMovie").innerHTML = data.movies.filter((movie) => movie.active).map((movie) => `<option value="${movie.id}">${EchoApi.escapeHtml(movie.title)}</option>`).join("");
    document.getElementById("showtimeScreen").innerHTML = data.screens.map((screen) => `<option value="${screen.id}">${EchoApi.escapeHtml(screen.name)}</option>`).join("");
    document.getElementById("adminBookings").innerHTML = data.bookings.map((booking) => `<tr><td>${EchoApi.escapeHtml(booking.reference)}</td><td>${EchoApi.escapeHtml(booking.customerName)}</td><td>${EchoApi.escapeHtml(booking.movieTitle)}</td><td>${EchoApi.escapeHtml(booking.seatCodes || "")}</td><td><span class="status status-${EchoApi.escapeHtml(booking.status)}">${EchoApi.escapeHtml(booking.status)}</span></td><td>${["cancelled", "expired", "payment_failed"].includes(booking.status) ? "—" : `<button class="button danger compact" data-cancel-booking="${booking.id}" type="button">Cancel</button>`}</td></tr>`).join("");
}

async function loadAdmin() {
    const { user } = await EchoApi.api("/api/auth/me");
    if (!user) {
        window.location.href = `login.html?returnTo=${encodeURIComponent("/admin.html")}`;
        return;
    }
    if (user.role !== "admin") throw new Error("Administrator access is required.");
    const data = await EchoApi.api("/api/admin/summary");
    render(data);
}

document.getElementById("movieForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await EchoApi.api("/api/admin/movies", { method: "POST", body: {
            title: document.getElementById("movieTitleInput").value,
            slug: document.getElementById("movieSlugInput").value,
            genre: document.getElementById("movieGenreInput").value,
            description: document.getElementById("movieDescriptionInput").value,
            keywords: document.getElementById("movieKeywordsInput").value,
            duration: document.getElementById("movieDurationInput").value,
            rating: document.getElementById("movieRatingInput").value,
            certificate: document.getElementById("movieCertificateInput").value,
            price: document.getElementById("moviePriceInput").value
        }});
        event.target.reset();
        showFeedback("Movie added.");
        await loadAdmin();
    } catch (error) { showFeedback(error.message, "error"); }
});

document.getElementById("showtimeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await EchoApi.api("/api/admin/showtimes", { method: "POST", body: {
            movieId: document.getElementById("showtimeMovie").value,
            screenId: document.getElementById("showtimeScreen").value,
            startsAt: new Date(document.getElementById("showtimeStart").value).toISOString(),
            price: document.getElementById("showtimePrice").value
        }});
        event.target.reset();
        showFeedback("Showtime added.");
        await loadAdmin();
    } catch (error) { showFeedback(error.message, "error"); }
});

document.getElementById("adminBookings").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-cancel-booking]");
    if (!button) return;
    try {
        await EchoApi.api(`/api/admin/bookings/${encodeURIComponent(button.dataset.cancelBooking)}/status`, { method: "PATCH", body: { status: "cancelled" } });
        showFeedback("Booking cancelled and seats released.");
        await loadAdmin();
    } catch (error) { showFeedback(error.message, "error"); }
});

loadAdmin().catch((error) => showFeedback(error.message, "error"));
