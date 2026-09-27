"use strict";

const { Pool } = require("pg");
const { config } = require("../config");

const pool = new Pool({
    connectionString: config.databaseUrl || undefined,
    ssl: config.isProduction ? { rejectUnauthorized: false } : false,
    max: config.isProduction ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error", error);
});

async function query(text, params = []) {
    return pool.query(text, params);
}

async function withTransaction(work) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, withTransaction };
