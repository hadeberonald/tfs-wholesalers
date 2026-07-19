const mongoose = require("mongoose");

/**
 * The set of bot text messages an admin is allowed to customize. Keep this
 * list in sync with services/messages.js (DEFAULTS) and the admin UI
 * (MESSAGE_SLOTS in app/[slug]/admin/whatsapp/_page.tsx).
 *
 * This file is duplicated into whatsapp-bot-2 (Dundee) and whatsapp-bot-3
 * (Ladysmith) as-is — it has no branch-specific content, since each bot
 * folder connects to its own database.
 */
const EDITABLE_KEYS = [
  "welcome_text",
  "main_menu_body",
  "promotions_menu_body",
  "location_text",
  "support_text",
  "specials_text",
  "retail_promo_fallback_text",
  "wholesale_promo_fallback_text",
  "order_text",
  "fallback_text",
];

const schema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
    enum: EDITABLE_KEYS,
  },
  value: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = { schema, EDITABLE_KEYS };
