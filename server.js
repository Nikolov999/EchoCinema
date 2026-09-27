"use strict";

require("dotenv").config();

const { createApp } = require("./src/app");
const { config } = require("./src/config");
const { pool } = require("./src/db/pool");

const app = createApp();
const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`Echo Cinema listening on ${config.appUrl}`);
});

async function shutdown(signal) {
    console.log(`${signal} received; shutting down.`);
    server.close(async () => {
        await pool.end().catch(() => undefined);
        process.exit(0);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
