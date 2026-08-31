const { getConnection } = require("../config/db");
const { schema } = require("./botMessageSchema");

const conn = getConnection();
module.exports = conn.models.BotMessage || conn.model("BotMessage", schema);
