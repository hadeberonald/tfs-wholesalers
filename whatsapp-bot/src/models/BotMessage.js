const mongoose = require("mongoose");
const { schema } = require("./botMessageSchema");

/**
 * Stores admin-edited overrides for the bot's text messages (see
 * botMessageSchema.js for the list of editable keys). One document per
 * `key` — saving a new value for the same key just replaces it (see the
 * upsert in the admin API route), so edits show up without a redeploy.
 *
 * If a key has no document yet, services/messages.js falls back to the
 * default text baked into data/menus.js.
 */
module.exports =
  mongoose.models.BotMessage || mongoose.model("BotMessage", schema);
