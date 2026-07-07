const mongoose = require("mongoose");

const messageIndexSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true, index: true }, // wamid
  agentWaId: { type: String, required: true },
  customerWaId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // auto-clean after 7 days
});

module.exports = mongoose.models.MessageIndex || mongoose.model("MessageIndex", messageIndexSchema);
