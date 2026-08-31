// routes/analytics.js
const express = require("express");
const router = express.Router();
const { getKpis, getKpisWithComparison } = require("../services/analytics");

// _2 suffix = Ladysmith's own shared secret, separate from Dundee's
// ANALYTICS_API_KEY, so a leaked/rotated key on one branch doesn't affect
// the other.
const { ANALYTICS_API_KEY_2: ANALYTICS_API_KEY } = process.env;

function requireApiKey(req, res, next) {
  if (!ANALYTICS_API_KEY) {
    return res.status(500).json({ error: "ANALYTICS_API_KEY_2 not configured on the bot server" });
  }
  if (req.headers["x-analytics-key"] !== ANALYTICS_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/**
 * GET /analytics/kpis?from=ISO&to=ISO&compare=false
 * Called server-to-server by the storefront admin app — the browser never
 * hits this directly. The Next.js route (/api/admin/analytics/whatsapp)
 * holds the actual admin auth/role check and forwards here with the
 * shared secret, so this endpoint only needs to trust the key.
 *
 * Defaults to including period-over-period growth (one extra query for the
 * previous window) since the admin report renders growth badges on every
 * tile. Pass compare=false to skip that if a caller only wants the raw
 * window's numbers.
 */
router.get("/kpis", requireApiKey, async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const compare = req.query.compare !== "false";

    if (isNaN(from) || isNaN(to) || from >= to) {
      return res.status(400).json({ error: "Invalid from/to range" });
    }

    res.json(compare ? await getKpisWithComparison(from, to) : await getKpis(from, to));
  } catch (err) {
    console.error("GET /analytics/kpis failed:", err);
    res.status(500).json({ error: "Failed to compute KPIs" });
  }
});

module.exports = router;