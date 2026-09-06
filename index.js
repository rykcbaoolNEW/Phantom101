const express = require("express");
const path = require("path");
const psl = require("psl");

const app = express();
const PORT = 3000;

const ENABLE_LOG = true;

// Example allowlist
const allowedDomains = new Set([
    "example.com",
    "www.example.com"
]);

function isAllowedDomain(domain) {
    return allowedDomains.has(domain);
}

// Serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Caddy on-demand TLS check
app.get("/tls-check", (req, res) => {
    const ip = req.ip === "::1" ? "127.0.0.1" : req.ip;

    if (ip !== "127.0.0.1") {
        return res.sendStatus(403);
    }

    const domain = String(req.query.domain || "")
        .toLowerCase()
        .trim();

    if (!domain) {
        return res.sendStatus(403);
    }

    const parsed = psl.parse(domain);

    if (parsed.error || !parsed.domain) {
        return res.sendStatus(403);
    }

    if (!isAllowedDomain(domain)) {
        return res.sendStatus(403);
    }

    if (ENABLE_LOG) {
        console.log("TLS CHECK:", domain, "→", parsed.domain);
    }

    return res.sendStatus(200);
});

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Express running on 127.0.0.1:${PORT}`);
});
