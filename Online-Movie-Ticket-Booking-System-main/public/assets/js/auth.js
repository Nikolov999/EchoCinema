"use strict";

const feedback = document.getElementById("authFeedback");
const params = new URLSearchParams(window.location.search);
const requestedReturn = params.get("returnTo") || "/";
const returnTo = requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "/";

async function submitAuth(path, body) {
    try {
        feedback.textContent = "";
        await EchoApi.api(path, { method: "POST", body });
        window.location.href = returnTo;
    } catch (error) {
        feedback.textContent = error.message;
        feedback.className = "feedback error";
    }
}

document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuth("/api/auth/login", {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    });
});

document.getElementById("registerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuth("/api/auth/register", {
        name: document.getElementById("name").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    });
});
