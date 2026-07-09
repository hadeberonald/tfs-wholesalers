// models/AnalyticsEvent.js
const mongoose = require("mongoose");

/**
 * Append-only event log — the single source of truth for the admin
 * Analytics dashboard. Every KPI on that page is derived from aggregating
 * these events, since Session/QueueEntry only hold *current* state
 * (QueueEntry rows are deleted on close, MessageIndex auto-expires after
 * 7 days) and can't answer "how many orders did we get in March".
 *
 * Keep `type` values stable — the aggregation pipelines key off them by
 * exact string match. Add new types freely; don't rename existing ones
 * without updating services/analytics.js and the admin dashboard together.
 */
const analyticsEventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    index: true,
    enum: [
      "menu_viewed",        // main menu sent (greeting or "menu" typed)
      "menu_row_selected",  // any list row tapped — meta.rowId
      "order_started",      // customer selected "order", name capture began
      "handoff_started",    // handed to an agent — meta.queue, agentWaId
      "handoff_closed",     // agent closed the chat — meta.queue, meta.durationMs
      "promo_sent",         // promo/specials doc delivered — meta.key
      "promo_fallback",     // nothing uploaded, or send failed — meta.key, meta.reason
      "fallback_triggered", // bot didn't understand the customer's free text
      "agent_message",      // agent -> customer relay — agentWaId
      "customer_message",   // customer -> agent relay (in handoff) — agentWaId
      "message_sent",       // any outbound msg to a customer — meta.kind: 'chatbot'|'template', meta.messageType: 'text'|'list'|'document'|'template'
      "message_received",   // any inbound msg from a customer — meta.messageType
      "message_status",     // delivery webhook — meta.status, meta.pricingCategory, meta.billable, meta.conversationOrigin
    ],
  },
  waId: { type: String, index: true, default: null },      // customer, when applicable
  agentWaId: { type: String, index: true, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Common dashboard query shape: "events of type X between two dates".
analyticsEventSchema.index({ type: 1, createdAt: 1 });

module.exports =
  mongoose.models.AnalyticsEvent || mongoose.model("AnalyticsEvent", analyticsEventSchema);