const mongoose = require("mongoose");

/**
 * Generic named counter, atomically incremented via $inc — used anywhere
 * we need a strict, tie-free ordering (e.g. "most recently touched
 * conversation") or a gapless-enough sequence (e.g. per-agent #codes).
 *
 * Millisecond-resolution timestamps (Date.now()) can collide when several
 * operations happen in the same millisecond, which breaks "most recent"
 * ordering — a real risk under bursty message traffic, not just a test
 * artifact. A counter sidesteps that entirely.
 */
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.models.Counter || mongoose.model("Counter", counterSchema);
