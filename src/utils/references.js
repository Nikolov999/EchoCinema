"use strict";

const crypto = require("node:crypto");

function reference(prefix) {
    return `${prefix}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

module.exports = { reference };
