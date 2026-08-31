const mongoose = require("mongoose");

/**
 * Stores the currently-active file for each promo/specials slot the bot can
 * send. One document per `key` — uploading a new file for the same key just
 * replaces it (see the upsert in the admin API route), so the bot always
 * sends whatever was most recently uploaded without needing a redeploy.
 *
 * This file is duplicated into whatsapp-bot-branch2 (Ladysmith) and
 * whatsapp-bot-branch3 (Vryheid) as-is — it has no branch-specific content,
 * since each bot folder connects to its own database. Kept separate from
 * PromoDocument.js (mirrors the botMessageSchema.js / BotMessage.js split)
 * so app/api/admin/promo-files/route.ts can compile this same schema against
 * a branch's own alternate connection, instead of only being able to reuse
 * whatsapp-bot's own live connection.
 */
const schema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
    enum: ["retail_promo", "wholesale_promo", "daily_specials"],
  },
  fileUrl: { type: String, required: true },   // Cloudinary secure_url
  filename: { type: String, required: true },  // shown to the customer as the doc's filename
  caption: { type: String, default: "" },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = { schema };
