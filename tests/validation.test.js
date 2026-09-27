"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    validateRegistration,
    validateLogin,
    validateSeatCodes,
    normalizeEmail,
    isUuid
} = require("../src/utils/validation");

test("normalizes an email address", () => {
    assert.equal(normalizeEmail("  Student@Example.COM "), "student@example.com");
});

test("accepts a valid registration", () => {
    const result = validateRegistration({
        name: "Bobo Nikolov",
        email: "bobo@example.com",
        password: "Password123!"
    });
    assert.equal(result.valid, true);
});

test("rejects an invalid registration", () => {
    const result = validateRegistration({ name: "B", email: "wrong", password: "short" });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 3);
});

test("validates a login payload", () => {
    assert.equal(validateLogin({ email: "student@example.com", password: "Student123!" }).valid, true);
});

test("normalizes, deduplicates, and limits seat codes", () => {
    const seats = validateSeatCodes(["a1", "A1", "B2", "bad", "C3"]);
    assert.deepEqual(seats, ["A1", "B2", "C3"]);
});

test("recognizes UUID values", () => {
    assert.equal(isUuid("123e4567-e89b-42d3-a456-426614174000"), true);
    assert.equal(isUuid("not-a-uuid"), false);
});
