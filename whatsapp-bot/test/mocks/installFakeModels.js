const { createFakeModel } = require("./fakeModel");

/**
 * Must be called BEFORE requiring sessionStore.js / conversationStore.js /
 * handoff.js / menuRouter.js anywhere in the test process — it intercepts
 * their `require("../models/Session")` etc. calls and hands back fakes
 * instead of the real Mongoose models (which would try to hit a real DB).
 */
function installFakeModels() {
  const sessionPath = require.resolve("../../src/models/Session");
  const queueEntryPath = require.resolve("../../src/models/QueueEntry");
  const messageIndexPath = require.resolve("../../src/models/MessageIndex");
  const counterPath = require.resolve("../../src/models/Counter");

  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: createFakeModel() };
  require.cache[queueEntryPath] = { id: queueEntryPath, filename: queueEntryPath, loaded: true, exports: createFakeModel() };
  require.cache[messageIndexPath] = { id: messageIndexPath, filename: messageIndexPath, loaded: true, exports: createFakeModel() };
  require.cache[counterPath] = { id: counterPath, filename: counterPath, loaded: true, exports: createFakeModel() };
}

module.exports = { installFakeModels };
