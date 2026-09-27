"use strict";

require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("./pool");

async function migrate() {
    const schemaPath = path.join(__dirname, "../../database/schema.sql");
    const sql = await fs.readFile(schemaPath, "utf8");
    await pool.query(sql);
    console.log("Database schema applied.");
}

migrate()
    .catch((error) => {
        console.error("Database migration failed:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
