"use strict";

async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body !== "string") {
        headers["Content-Type"] = "application/json";
        options = { ...options, body: JSON.stringify(options.body) };
    }
    const response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
        const error = new Error(payload?.error || `Request failed with status ${response.status}.`);
        error.status = response.status;
        error.details = payload?.details;
        error.payload = payload;
        throw error;
    }
    return payload;
}

function money(cents) {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}

function dateTime(value) {
    return new Intl.DateTimeFormat("en-IE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

window.EchoApi = { api, money, dateTime, escapeHtml };
