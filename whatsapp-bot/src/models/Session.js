const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  waId: { type: String, required: true, unique: true, index: true },
  currentMenu: { type: String, default: "main_menu" },
  mode: { type: String, enum: ["bot", "handoff"], default: "bot" },
  handoffTo: { type: String, default: null }, // agent wa_id, if in handoff
  handoffQueue: { type: String, default: null }, // "orders" | "support"
  orderName: { type: String, default: null },
  lastActive: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Session || mongoose.model("Session", sessionSchema);
