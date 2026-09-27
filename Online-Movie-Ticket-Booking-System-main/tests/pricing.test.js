"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculatePricing, formatMoney } = require("../src/utils/pricing");

test("calculates subtotal without a promo", () => {
    assert.deepEqual(calculatePricing({ seatCount: 2, priceCents: 1250 }), {
        subtotalCents: 2500,
        discountCents: 0,
        totalCents: 2500
    });
});

test("applies a percentage discount using integer cents", () => {
    assert.deepEqual(calculatePricing({ seatCount: 3, priceCents: 1300, percentageOff: 10 }), {
        subtotalCents: 3900,
        discountCents: 390,
        totalCents: 3510
    });
});

test("clamps invalid pricing input", () => {
    assert.deepEqual(calculatePricing({ seatCount: -1, priceCents: -10, percentageOff: 500 }), {
        subtotalCents: 0,
        discountCents: 0,
        totalCents: 0
    });
});

test("formats euro amounts", () => {
    assert.match(formatMoney(1250), /12[.,]50/);
});
