const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    agentWaId: { type: String, required: true, index: true },
    customerWaId: { type: String, required: true, index: true },
    code: { type: Number, required: true },
    touchSeq: { type: Number, default: 0, index: true },
    name: { type: String, default: null },
    queueType: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

schema.index({ agentWaId: 1, customerWaId: 1 }, { unique: true });

module.exports = { schema };
