const mongoose = require("mongoose");

const queueEntrySchema = new mongoose.Schema(
  {
    agentWaId: { type: String, required: true, index: true },
    customerWaId: { type: String, required: true, index: true },
    code: { type: Number, required: true }, // short #N identifier, unique per agent
    touchSeq: { type: Number, default: 0, index: true }, // monotonic "most recent" ordering
    name: { type: String, default: null },
    queueType: { type: String, default: null }, // "orders" | "support"
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true } // adds updatedAt, used to determine "most recent" customer
);

// One active queue entry per (agent, customer) pair at a time
queueEntrySchema.index({ agentWaId: 1, customerWaId: 1 }, { unique: true });

module.exports = mongoose.models.QueueEntry || mongoose.model("QueueEntry", queueEntrySchema);
