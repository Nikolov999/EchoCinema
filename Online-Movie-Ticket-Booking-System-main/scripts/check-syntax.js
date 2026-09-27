"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const roots = ["server.js", "src", "public/assets/js", "tests", "scripts"];
const files = [];

function walk(target) {
    const full = path.resolve(target);
    const stat = fs.statSync(full);
    if (stat.isFile() && full.endsWith(".js")) {
        files.push(full);
        return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of fs.readdirSync(full)) walk(path.join(full, entry));
}

for (const root of roots) walk(root);

let failed = false;
for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
