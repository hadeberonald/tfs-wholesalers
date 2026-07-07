const mongoose = require("mongoose");

/**
 * Stores the currently-active file for each promo/specials slot the bot can
 * send. One document per `key` — uploading a new file for the same key just
 * replaces it (see the upsert in the admin API route), so the bot always
 * sends whatever was most recently uploaded without needing a redeploy.
 */
const promoDocumentSchema = new mongoose.Schema({
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

module.exports =
  mongoose.models.PromoDocument || mongoose.model("PromoDocument", promoDocumentSchema);
