const QueueEntry = require("../models/QueueEntry");
const MessageIndex = require("../models/MessageIndex");
const Counter = require("../models/Counter");

/**
 * Atomically returns the next number for a named counter. Used both for
 * per-agent #codes and for "most recently touched" ordering — a real
 * monotonic counter instead of comparing Date timestamps, which can tie
 * when operations happen in the same millisecond (this bit us in testing:
 * two customers messaging in quick succession got identical `updatedAt`
 * values, and the "most recent" lookup silently fell back to insertion
 * order instead of true recency).
 */
async function nextSeq(name) {
  const doc = await Counter.findOneAndUpdate({ name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
}

async function addToQueue(agentWaId, customerWaId, meta = {}) {
  const existing = await QueueEntry.findOne({ agentWaId, customerWaId });
  if (existing) {
    Object.assign(existing, meta);
    existing.touchSeq = await nextSeq(`touch:${agentWaId}`);
    await existing.save();
    return existing;
  }

  const code = await nextSeq(`code:${agentWaId}`);
  const touchSeq = await nextSeq(`touch:${agentWaId}`);
  return QueueEntry.create({ agentWaId, customerWaId, code, touchSeq, ...meta });
}

async function removeFromQueue(agentWaId, customerWaId) {
  await QueueEntry.deleteOne({ agentWaId, customerWaId });
}

async function listQueue(agentWaId) {
  const docs = await QueueEntry.find({ agentWaId }).sort({ code: 1 });
  return docs.map((d) => ({
    customerWaId: d.customerWaId,
    code: d.code,
    name: d.name,
    queueType: d.queueType,
    startedAt: d.startedAt.getTime(),
  }));
}

async function getEntry(agentWaId, customerWaId) {
  return QueueEntry.findOne({ agentWaId, customerWaId });
}

async function getByCode(agentWaId, code) {
  const entry = await QueueEntry.findOne({ agentWaId, code });
  return entry?.customerWaId || null;
}

/** Whichever queue entry for this agent has the highest touchSeq. */
async function getMostRecent(agentWaId) {
  const entry = await QueueEntry.findOne({ agentWaId }).sort({ touchSeq: -1 });
  return entry?.customerWaId || null;
}

async function setMostRecent(agentWaId, customerWaId) {
  const entry = await QueueEntry.findOne({ agentWaId, customerWaId });
  if (entry) {
    entry.touchSeq = await nextSeq(`touch:${agentWaId}`);
    await entry.save();
  }
}

async function recordOutgoingMessage(messageId, agentWaId, customerWaId) {
  if (!messageId) return;
  await MessageIndex.findOneAndUpdate(
    { messageId },
    { messageId, agentWaId, customerWaId },
    { upsert: true }
  );
}

async function lookupByMessageId(messageId) {
  const doc = await MessageIndex.findOne({ messageId });
  return doc ? { agentWaId: doc.agentWaId, customerWaId: doc.customerWaId } : null;
}

module.exports = {
  addToQueue,
  removeFromQueue,
  listQueue,
  getEntry,
  getByCode,
  getMostRecent,
  setMostRecent,
  recordOutgoingMessage,
  lookupByMessageId,
};
