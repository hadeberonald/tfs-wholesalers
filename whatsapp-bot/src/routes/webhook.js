const express = require("express");
const router = express.Router();
const { handleIncomingMessage } = require("../services/menuRouter");
const { markAsRead } = require("../services/whatsapp");
const handoff = require("../services/handoff");

const { VERIFY_TOKEN } = process.env;

/**
 * GET /webhook
 * Meta calls this once when you save the webhook config in the App Dashboard,
 * and periodically to re-verify. Must echo back hub.challenge if the
 * verify token matches.
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully.");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * POST /webhook
 * Meta calls this on every incoming message/status update.
 * Always respond 200 quickly — Meta retries aggressively on non-200s,
 * so do the real work async and don't block the response on it.
 */
router.post("/", async (req, res) => {
  // Respond immediately; process after
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore status callbacks (sent/delivered/read receipts for OUR messages)
    if (!value?.messages) return;

    const message = value.messages[0];
    const waId = message.from; // sender's WhatsApp ID (phone number, no +)

    await markAsRead(message.id).catch((err) =>
      console.error("markAsRead failed:", err.response?.data || err.message)
    );

    // Is this message FROM one of our human agents (replying to a customer),
    // or FROM a customer (going through the normal bot flow)?
    if (handoff.isAgentNumber(waId)) {
      if (message.type === "text") {
        await handoff.relayAgentToCustomer(waId, message);
      }
      return;
    }

    await handleIncomingMessage(waId, message);
  } catch (err) {
    console.error("Error handling webhook payload:", err.response?.data || err);
  }
});

module.exports = router;
