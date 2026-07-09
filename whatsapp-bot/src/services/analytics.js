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
 * Full KPI bundle for an arbitrary [from, to) window. Powers both the
 * "custom range" and the weekly/monthly report views — those just compute
 * from/to differently before calling in here.
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

    // ── new aggregations below ──────────────────────────────────────────
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

  return {
    range: { from, to },
    totalsByType: totalsByTypeObj,
    uniqueCustomers: uniqueCustomers.length,
    ordersStarted,
    handoffsStarted: Object.fromEntries(handoffsStarted.map((h) => [h._id || "unknown", h.count])),
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
    hourlyHistogram, // [{ _id: 0-23, count }] — busiest-hours chart
    dailySeries,      // trend line chart
    agentBreakdown,
    currentlyQueued,

    // messages sent vs received (snapshot tiles + bar chart)
    messagesSent: totalsByTypeObj.message_sent || 0,
    messagesReceived: totalsByTypeObj.message_received || 0,

    // messages sent breakdown by type: text | list | document | template
    messagesSentByType,

    // chatbot vs template messages sent
    messageKindBreakdown,

    // delivery status: sent | delivered | read | failed (drives "messages delivered" tile)
    messageStatusBreakdown,
    messagesDelivered: messageStatusBreakdown.delivered || 0,

    // pricing analytics: { marketing: {count, billableCount}, utility: {...}, service: {...}, authentication: {...} }
    pricingBreakdown,

    // engagements per page/option (menu_row_selected by rowId)
    pageEngagements,
    uniqueEngagements: Object.values(pageEngagements).reduce((a, b) => a + b, 0),

    // live chat tickets completed per agent (raw wa_id as key, per product decision)
    ticketsPerAgent,
  };
}

module.exports = { logEvent, getKpis };