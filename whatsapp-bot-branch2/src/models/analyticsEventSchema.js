// models/analyticsEventSchema.js
const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    index: true,
    enum: [
      "menu_viewed",
      "menu_row_selected",
      "order_started",
      "handoff_started",
      "handoff_closed",
      "promo_sent",
      "promo_fallback",
      "fallback_triggered",
      "agent_message",
      "customer_message",
      "message_sent",
      "message_received",
      "message_status",
    ],
  },
  waId: { type: String, index: true, default: null },
  agentWaId: { type: String, index: true, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

schema.index({ type: 1, createdAt: 1 });

module.exports = { schema };
