const { getConnection } = require("../config/db");
const { schema } = require("./promoDocumentSchema");

/**
 * Schema lives in promoDocumentSchema.js (shared, unmodified copy across
 * branches). Compiled here against Ladysmith's own connection, not the
 * default one — same reasoning as Session.js etc. in this folder.
 */
const conn = getConnection();
module.exports = conn.models.PromoDocument || conn.model("PromoDocument", schema);
