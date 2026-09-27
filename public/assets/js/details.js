"use strict";

const slug = new URLSearchParams(window.location.search).get("id") || "interstellar";
const feedback = document.getElementById("movieFeedback");

(async () => {
    try {
        const { movie, showtimes } = await EchoApi.api(`/api/movies/${encodeURIComponent(slug)}`);
        document.getElementById("movieTitle").textContent = movie.title;
        document.getElementById("movieDescription").textContent = movie.description;
        document.getElementById("moviePoster").style.setProperty("--poster-gradient", movie.gradient);
        document.getElementById("movieGenre").textContent = movie.genre;
        document.getElementById("movieDuration").textContent = `${movie.duration} minutes`;
        document.getElementById("movieRating").textContent = `${movie.rating}/10`;
        document.getElementById("movieCertificate").textContent = movie.certificate;
        document.title = `${movie.title} | Echo Cinema`;

        const list = document.getElementById("showtimeList");
        if (!showtimes.length) {
            list.innerHTML = '<div class="message">No future showtimes are currently scheduled.</div>';
            return;
        }
        list.innerHTML = showtimes.map((showtime) => `
            <a class="button showtime-button" href="seats.html?showtime=${encodeURIComponent(showtime.id)}">
                ${EchoApi.escapeHtml(EchoApi.dateTime(showtime.startsAt))} · ${EchoApi.money(showtime.priceCents)}
            </a>`).join("");
    } catch (error) {
        feedback.textContent = error.message;
        feedback.className = "feedback error";
    }
})();
