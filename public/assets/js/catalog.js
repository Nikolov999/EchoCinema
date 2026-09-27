"use strict";

const movieGrid = document.getElementById("movieGrid");
const searchInput = document.getElementById("movieSearch");
const clearSearchButton = document.getElementById("clearSearch");
const noResults = document.getElementById("noResults");
const systemStatus = document.getElementById("systemStatus");
let searchTimer;

function movieCardMarkup(movie) {
    return `
        <article class="movie-card">
            <div class="poster" style="--poster-gradient: ${EchoApi.escapeHtml(movie.gradient)}"><span>Now showing</span></div>
            <div class="movie-card-body">
                <h2>${EchoApi.escapeHtml(movie.title)}</h2>
                <div class="movie-meta"><span>${EchoApi.escapeHtml(movie.genre)}</span><span>${movie.duration} min</span><span>${movie.rating}/10</span></div>
                <p>${EchoApi.escapeHtml(movie.description)}</p>
                <a class="button" href="movie.html?id=${encodeURIComponent(movie.slug)}">View details</a>
            </div>
        </article>`;
}

async function renderMovies(searchTerm = "") {
    try {
        movieGrid.setAttribute("aria-busy", "true");
        const query = searchTerm.trim() ? `?q=${encodeURIComponent(searchTerm.trim())}` : "";
        const { movies } = await EchoApi.api(`/api/movies${query}`);
        movieGrid.innerHTML = movies.map(movieCardMarkup).join("");
        noResults.classList.toggle("hidden", movies.length !== 0);
    } catch (error) {
        movieGrid.innerHTML = `<div class="message error">${EchoApi.escapeHtml(error.message)}</div>`;
    } finally {
        movieGrid.removeAttribute("aria-busy");
    }
}

searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => renderMovies(searchInput.value), 180);
});

clearSearchButton.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    renderMovies();
});

(async () => {
    try {
        const health = await EchoApi.api("/api/health");
        systemStatus.textContent = `Server online · PostgreSQL ${health.database} · ${health.paymentMode} payment mode`;
    } catch (error) {
        systemStatus.textContent = `Setup required: ${error.message}`;
    }
    await renderMovies();
})();
