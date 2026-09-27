"use strict";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEAT_PATTERN = /^[A-Z][1-9][0-9]?$/;

function cleanString(value, maxLength = 500) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeEmail(value) {
    return cleanString(value, 254).toLowerCase();
}

function validateRegistration(body) {
    const name = cleanString(body?.name, 100);
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : "";
    const errors = [];

    if (name.length < 2) errors.push("Name must contain at least 2 characters.");
    if (!EMAIL_PATTERN.test(email)) errors.push("Enter a valid email address.");
    if (password.length < 8 || password.length > 128) errors.push("Password must contain 8 to 128 characters.");

    return { valid: errors.length === 0, errors, value: { name, email, password } };
}

function validateLogin(body) {
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : "";
    const errors = [];
    if (!EMAIL_PATTERN.test(email)) errors.push("Enter a valid email address.");
    if (!password) errors.push("Password is required.");
    return { valid: errors.length === 0, errors, value: { email, password } };
}

function validateSeatCodes(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((seat) => cleanString(seat, 3).toUpperCase()).filter((seat) => SEAT_PATTERN.test(seat)))].slice(0, 10);
}

function isUuid(value) {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

function parsePositiveInteger(value, fallback = 0) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
    cleanString,
    normalizeEmail,
    validateRegistration,
    validateLogin,
    validateSeatCodes,
    isUuid,
    parsePositiveInteger
};
