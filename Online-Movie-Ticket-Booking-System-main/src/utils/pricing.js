"use strict";

function calculatePricing({ seatCount, priceCents, percentageOff = 0 }) {
    const safeSeatCount = Number.isInteger(seatCount) && seatCount > 0 ? seatCount : 0;
    const safePrice = Number.isInteger(priceCents) && priceCents >= 0 ? priceCents : 0;
    const safePercentage = Number.isInteger(percentageOff)
        ? Math.min(100, Math.max(0, percentageOff))
        : 0;

    const subtotalCents = safeSeatCount * safePrice;
    const discountCents = Math.round(subtotalCents * (safePercentage / 100));
    return {
        subtotalCents,
        discountCents,
        totalCents: subtotalCents - discountCents
    };
}

function formatMoney(cents, currency = "EUR") {
    return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency
    }).format((cents || 0) / 100);
}

module.exports = { calculatePricing, formatMoney };
