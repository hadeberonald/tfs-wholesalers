const { getConnection } = require("../config/db");
const { schema } = require("./messageIndexSchema");

const conn = getConnection();
module.exports = conn.models.MessageIndex || conn.model("MessageIndex", schema);
