const mongoose = require("mongoose");
const { schema } = require("./promoDocumentSchema");

/**
 * Stores the currently-active file for each promo/specials slot the bot can
 * send. One document per `key` — uploading a new file for the same key just
 * replaces it (see the upsert in the admin API route), so the bot always
 * sends whatever was most recently uploaded without needing a redeploy.
 *
 * Schema lives in promoDocumentSchema.js (see that file for why) — this file
 * just compiles it against the bot's own live mongoose connection.
 */
module.exports =
  mongoose.models.PromoDocument || mongoose.model("PromoDocument", schema);
