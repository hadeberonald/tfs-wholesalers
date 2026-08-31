const { getConnection } = require("../config/db");
const { schema } = require("./analyticsEventSchema");

const conn = getConnection();
module.exports = conn.models.AnalyticsEvent || conn.model("AnalyticsEvent", schema);
