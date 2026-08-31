const { getConnection } = require("../config/db");
const { schema } = require("./queueEntrySchema");

const conn = getConnection();
module.exports = conn.models.QueueEntry || conn.model("QueueEntry", schema);
