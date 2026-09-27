"use strict";

function notFound(req, res) {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found." });
    }
    res.status(404).sendFile("404.html", { root: require("node:path").join(__dirname, "../../public") });
}

function errorHandler(error, req, res, next) {
    void next;
    console.error(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
        error: status >= 500 ? "An unexpected server error occurred." : error.message,
        details: error.details || undefined
    });
}

module.exports = { notFound, errorHandler };
