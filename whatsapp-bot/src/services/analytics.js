// services/analytics.js
const AnalyticsEvent = require("../models/AnalyticsEvent");
const QueueEntry = require("../models/QueueEntry");

/**
 * Fire-and-forget event logging. Analytics must never break the actual
 * message flow, so failures here are swallowed (and logged) rather than
 * thrown — a lost KPI event is fine, a customer stuck mid-conversation
 * because analytics.create() rejected is not.
 */
async function logEvent(type, { waId = null, agentWaId = null, meta = {} } = {}) {
  try {
    await AnalyticsEvent.create({ type, waId, agentWaId, meta });
  } catch (err) {
    console.error(`logEvent(${type}) failed:`, err.message);
  }
}

/**
 * Meta charges per conversation-category (marketing / utility / service /
 * authentication), and the rate depends on your WABA's country + Meta's
 * current price card — there's no way to derive it from the webhook data
 * alone. These are pulled from env so a real number can be dropped in
 * without a code change; they default to 0 (spend shows as R0.00 / "not
 * configured") rather than guessing a number that could be wrong.
 *
 * Set these in the bot's .env to whatever your current Meta price card says:
 *   WA_RATE_MARKETING, WA_RATE_UTILITY, WA_RATE_SERVICE, WA_RATE_AUTHENTICATION
 *   WA_RATE_CURRENCY (defaults to ZAR)
 */
const RATES = {
  marketing: parseFloat(process.env.WA_RATE_MARKETING || "0"),
  utility: parseFloat(process.env.WA_RATE_UTILITY || "0"),
  service: parseFloat(process.env.WA_RATE_SERVICE || "0"),
  authentication: parseFloat(process.env.WA_RATE_AUTHENTICATION || "0"),
};
const RATE_CURRENCY = process.env.WA_RATE_CURRENCY || "ZAR";
const RATES_CONFIGURED = Object.values(RATES).some((r) => r > 0);

/**
 * Core KPI bundle for an arbitrary [from, to) window. Powers both the
 * "custom range" and the weekly/monthly report views — those just compute
 * from/to differently before calling in here. Also called twice (current +
 * previous period) by getKpisWithComparison below.
 */
async function getKpis(from, to) {
  const match = { createdAt: { $gte: from, $lt: to } };

  const [
    totalsByType,
    uniqueCustomers,
    ordersStarted,
    handoffsStarted,
    handoffsClosed,
    promoBreakdownRaw,
    hourlyHistogram,
    dailySeries,
    agentBreakdownRaw,
    currentlyQueued,
    sentByMessageTypeRaw,
    sentByKindRaw,
    statusBreakdownRaw,
    pricingBreakdownRaw,
    pageEngagementRaw,
    agentTicketsRaw,
    dailySentReceivedRaw,
  ] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.distinct("waId", { ...match, waId: { $ne: null } }),
    AnalyticsEvent.countDocuments({ ...match, type: "order_started" }),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "handoff_started" } },
      { $group: { _id: "$meta.queue", count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "handoff_closed" } },
      {
        $group: {
          _id: "$meta.queue",
          count: { $sum: 1 },
          avgHandleMs: { $avg: "$meta.durationMs" },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: { $in: ["promo_sent", "promo_fallback"] } } },
      { $group: { _id: { key: "$meta.key", type: "$type" }, count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: match },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          uniqueCustomers: { $addToSet: "$waId" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          count: 1,
          uniqueCustomers: { $size: "$uniqueCustomers" },
          _id: 0,
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, agentWaId: { $ne: null } } },
      { $group: { _id: { agentWaId: "$agentWaId", type: "$type" }, count: { $sum: 1 } } },
    ]),
    QueueEntry.countDocuments({}), // live snapshot, not period-scoped

    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "message_sent" } },
      { $group: { _id: "$meta.messageType", count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "message_sent" } },
      { $group: { _id: "$meta.kind", count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "message_status" } },
      { $group: { _id: "$meta.status", count: { $sum: 1 } } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "message_status", "meta.pricingCategory": { $ne: null } } },
      {
        $group: {
          _id: "$meta.pricingCategory",
          count: { $sum: 1 },
          billableCount: { $sum: { $cond: ["$meta.billable", 1, 0] } },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "menu_row_selected" } },
      { $group: { _id: "$meta.rowId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: "handoff_closed", agentWaId: { $ne: null } } },
      { $group: { _id: "$agentWaId", count: { $sum: 1 } } },
    ]),

    // Day-by-day sent vs received split — powers the page 1 grouped bar
    // chart. (dailySeries above only tracks combined event volume.)
    AnalyticsEvent.aggregate([
      { $match: { ...match, type: { $in: ["message_sent", "message_received"] } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]),
  ]);

  // Reshape a couple of the raw aggregations into flatter, chart-friendly shapes.
  const promoBreakdown = {};
  for (const row of promoBreakdownRaw) {
    const key = row._id.key || "unknown";
    promoBreakdown[key] = promoBreakdown[key] || { sent: 0, fallback: 0 };
    promoBreakdown[key][row._id.type === "promo_sent" ? "sent" : "fallback"] = row.count;
  }

  const agentBreakdown = {};
  for (const row of agentBreakdownRaw) {
    const agent = row._id.agentWaId;
    agentBreakdown[agent] = agentBreakdown[agent] || {};
    agentBreakdown[agent][row._id.type] = row.count;
  }

  const totalsByTypeObj = Object.fromEntries(totalsByType.map((t) => [t._id, t.count]));

  const messagesSentByType = Object.fromEntries(
    sentByMessageTypeRaw.map((r) => [r._id || "unknown", r.count])
  );
  const messageKindBreakdown = Object.fromEntries(
    sentByKindRaw.map((r) => [r._id || "chatbot", r.count])
  );
  const messageStatusBreakdown = Object.fromEntries(
    statusBreakdownRaw.map((r) => [r._id || "unknown", r.count])
  );
  const pricingBreakdown = Object.fromEntries(
    pricingBreakdownRaw.map((r) => [r._id, { count: r.count, billableCount: r.billableCount }])
  );
  const pageEngagements = Object.fromEntries(
    pageEngagementRaw.map((r) => [r._id || "unknown", r.count])
  );
  const ticketsPerAgent = Object.fromEntries(agentTicketsRaw.map((r) => [r._id, r.count]));

  // { "2026-07-01": { sent: 12, received: 9 }, ... } -> sorted array
  const byDate = {};
  for (const row of dailySentReceivedRaw) {
    const { date, type } = row._id;
    byDate[date] = byDate[date] || { date, sent: 0, received: 0 };
    byDate[date][type === "message_sent" ? "sent" : "received"] = row.count;
  }
  const dailyMessageTypeSeries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  // Billable spend: cost is only ever an estimate we can compute from *our*
  // side (rate x billable count) — Meta doesn't hand back an invoice amount
  // per message. Rates default to 0 until configured (see RATES above), in
  // which case cost fields are still present but will read as 0 rather than
  // silently vanishing, so the UI can distinguish "no spend" from "not
  // configured" via `ratesConfigured`.
  const billableSpendBreakdown = {};
  let billableSpendTotal = 0;
  let totalBillableMessages = 0;
  for (const [category, stats] of Object.entries(pricingBreakdown)) {
    const rate = RATES[category] ?? 0;
    const cost = +(stats.billableCount * rate).toFixed(2);
    billableSpendBreakdown[category] = { ...stats, rate, cost };
    billableSpendTotal += cost;
    totalBillableMessages += stats.billableCount;
  }
  billableSpendTotal = +billableSpendTotal.toFixed(2);

  const messagesSent = totalsByTypeObj.message_sent || 0;
  const messagesDelivered = messageStatusBreakdown.delivered || 0;
  const handoffsStartedObj = Object.fromEntries(handoffsStarted.map((h) => [h._id || "unknown", h.count]));
  const promosDownloadedTotal = Object.values(promoBreakdown).reduce((a, p) => a + (p.sent || 0), 0);
  const liveChatSessionsTotal = Object.values(handoffsStartedObj).reduce((a, b) => a + b, 0);
  const ticketsCompletedTotal = Object.values(ticketsPerAgent).reduce((a, b) => a + b, 0);

  return {
    range: { from, to },
    totalsByType: totalsByTypeObj,
    uniqueCustomers: uniqueCustomers.length,
    ordersStarted,
    handoffsStarted: handoffsStartedObj,
    handoffsClosed: Object.fromEntries(
      handoffsClosed.map((h) => [
        h._id || "unknown",
        {
          count: h.count,
          avgHandleMinutes: h.avgHandleMs ? +(h.avgHandleMs / 60000).toFixed(1) : null,
        },
      ])
    ),
    promoBreakdown,
    promosDownloadedTotal,
    hourlyHistogram, // [{ _id: 0-23, count }] — busiest-hours chart
    dailySeries,      // trend line chart
    dailyMessageTypeSeries, // [{ date, sent, received }] — page 1 grouped bar chart
    agentBreakdown,
    currentlyQueued,

    // messages sent vs received (snapshot tiles + bar chart)
    messagesSent,
    messagesReceived: totalsByTypeObj.message_received || 0,

    // messages sent breakdown by type: text | list | document | template
    messagesSentByType,

    // chatbot vs template messages sent
    messageKindBreakdown,

    // delivery status: sent | delivered | read | failed (drives "messages delivered" tile)
    messageStatusBreakdown,
    messagesDelivered,
    deliveryRate: messagesSent ? +((messagesDelivered / messagesSent) * 100).toFixed(1) : 0,

    // pricing analytics: { marketing: {count, billableCount}, utility: {...}, service: {...}, authentication: {...} }
    pricingBreakdown,

    // estimated spend on billable (business-initiated / outside-24h) messages
    billableSpendBreakdown,
    billableSpendTotal,
    billableSpendCurrency: RATE_CURRENCY,
    billableRatesConfigured: RATES_CONFIGURED,
    totalBillableMessages,

    // engagements per page/option (menu_row_selected by rowId)
    pageEngagements,
    uniqueEngagements: Object.values(pageEngagements).reduce((a, b) => a + b, 0),

    // live chat tickets completed per agent (raw wa_id as key, per product decision)
    ticketsPerAgent,
    liveChatSessionsTotal,
    ticketsCompletedTotal,
  };
}

/**
 * Percent change helper for period-over-period growth. `null` means "no
 * baseline to compare against" (previous period was 0) — the UI should
 * render that as "New" rather than a misleading "+∞%" or "+100%".
 */
function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? null : 0;
  return +(((curr - prev) / prev) * 100).toFixed(1);
}

/**
 * Wraps getKpis with a matching previous-period lookup (same duration,
 * immediately preceding the requested range) and a `growth` object of
 * percent changes for the headline metrics. This is what the admin report
 * calls — the plain getKpis() above stays available for anything that just
 * wants a single window without paying for the extra query.
 */
async function getKpisWithComparison(from, to) {
  const duration = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - duration);
  const prevTo = new Date(from.getTime());

  const [current, previous] = await Promise.all([getKpis(from, to), getKpis(prevFrom, prevTo)]);

  const growth = {
    messagesSent: pctChange(current.messagesSent, previous.messagesSent),
    messagesReceived: pctChange(current.messagesReceived, previous.messagesReceived),
    messagesDelivered: pctChange(current.messagesDelivered, previous.messagesDelivered),
    deliveryRate: pctChange(current.deliveryRate, previous.deliveryRate),
    uniqueCustomers: pctChange(current.uniqueCustomers, previous.uniqueCustomers),
    uniqueEngagements: pctChange(current.uniqueEngagements, previous.uniqueEngagements),
    promosDownloaded: pctChange(current.promosDownloadedTotal, previous.promosDownloadedTotal),
    liveChatSessions: pctChange(current.liveChatSessionsTotal, previous.liveChatSessionsTotal),
    ticketsCompleted: pctChange(current.ticketsCompletedTotal, previous.ticketsCompletedTotal),
    billableSpend: pctChange(current.billableSpendTotal, previous.billableSpendTotal),
    totalBillableMessages: pctChange(current.totalBillableMessages, previous.totalBillableMessages),
  };

  return {
    ...current,
    previousPeriod: {
      range: previous.range,
      messagesSent: previous.messagesSent,
      messagesReceived: previous.messagesReceived,
      messagesDelivered: previous.messagesDelivered,
      uniqueCustomers: previous.uniqueCustomers,
      uniqueEngagements: previous.uniqueEngagements,
      promosDownloadedTotal: previous.promosDownloadedTotal,
      liveChatSessionsTotal: previous.liveChatSessionsTotal,
      ticketsCompletedTotal: previous.ticketsCompletedTotal,
      billableSpendTotal: previous.billableSpendTotal,
    },
    growth,
  };
}

module.exports = { logEvent, getKpis, getKpisWithComparison };