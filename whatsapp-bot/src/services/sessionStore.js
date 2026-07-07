const Session = require("../models/Session");

/**
 * Same function names/shape as the original in-memory version — every
 * caller just needed `await` added in front. Session survives restarts now.
 */

async function getSession(waId) {
  let doc = await Session.findOne({ waId });
  if (!doc) {
    doc = await Session.create({ waId });
  }
  return doc;
}

async function setSession(waId, updates) {
  const doc = await Session.findOneAndUpdate(
    { waId },
    { ...updates, lastActive: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
}

module.exports = { getSession, setSession };
