const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  waId: { type: String, required: true, unique: true, index: true },
  currentMenu: { type: String, default: "main_menu" },
  mode: { type: String, enum: ["bot", "handoff"], default: "bot" },
  handoffTo: { type: String, default: null },
  handoffQueue: { type: String, default: null },
  orderName: { type: String, default: null },
  lastActive: { type: Date, default: Date.now },
});

module.exports = { schema };
