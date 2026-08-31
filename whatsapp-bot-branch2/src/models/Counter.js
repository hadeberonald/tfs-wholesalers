const { getConnection } = require("../config/db");
const { schema } = require("./counterSchema");

const conn = getConnection();
module.exports = conn.models.Counter || conn.model("Counter", schema);
