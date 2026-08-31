const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  agentWaId: { type: String, required: true },
  customerWaId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

module.exports = { schema };
