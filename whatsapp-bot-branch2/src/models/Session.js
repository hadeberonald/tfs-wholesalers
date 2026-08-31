const { getConnection } = require("../config/db");
const { schema } = require("./sessionSchema");

/**
 * Compiled against Ladysmith's own connection (see config/db.js) instead
 * of the bare mongoose.model() the original file used — that would have
 * bound to the shared default connection and collided with Dundee's data.
 */
const conn = getConnection();
module.exports = conn.models.Session || conn.model("Session", schema);
