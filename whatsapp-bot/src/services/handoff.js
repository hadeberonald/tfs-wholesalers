// services/handoff.js — full file, with logEvent calls added
const { sendText, sendList } = require("./whatsapp");
const { getSession, setSession } = require("./sessionStore");
const conversations = require("./conversationStore");
const { logEvent } = require("./analytics");
const { ORDERS_AGENT, SUPPORT_AGENT, CLOSE_COMMANDS } = require("../config/agents");
const menus = require("../data/menus");

const AGENT_NUMBERS = new Set([ORDERS_AGENT, SUPPORT_AGENT]);
const QUEUE_COMMANDS = ["/queue", "/list", "/who"];

function isAgentNumber(waId) {
  return AGENT_NUMBERS.has(waId);
}

async function startHandoff(customerWaId, queue, contextLine, meta = {}) {
  const agentWaId = queue === "orders" ? ORDERS_AGENT : SUPPORT_AGENT;

  const entry = await conversations.addToQueue(agentWaId, customerWaId, { queueType: queue, ...meta });
  await setSession(customerWaId, { mode: "handoff", handoffTo: agentWaId, handoffQueue: queue });
  await logEvent("handoff_started", { waId: customerWaId, agentWaId, meta: { queue } });

  const label = queue === "orders" ? "🛒 New order" : "💬 New support query";
  const nameLine = meta.name ? `Name: ${meta.name}\n` : "";
  const msgId = await sendText(
    agentWaId,
    `${label}  [#${entry.code}]\n${nameLine}From: +${customerWaId}\n\n"${contextLine}"\n\n` +
      `Reply here (swipe to quote this message to target them specifically) to chat directly.\n` +
      `Send "/close ${entry.code}" or just swipe-reply + "/close" when done. Send "/queue" to see everyone waiting.`
  );
  await conversations.recordOutgoingMessage(msgId, agentWaId, customerWaId);

  await sendText(
    customerWaId,
    "You're now connected to a team member — they'll reply here shortly. " +
      "You can type \"menu\" at any time to go back to the automated menu."
  );
}

async function relayCustomerToAgent(customerWaId, text) {
  const session = await getSession(customerWaId);
  const agentWaId = session.handoffTo;
  if (!agentWaId) return false;

  const entry = await conversations.getEntry(agentWaId, customerWaId);
  await conversations.setMostRecent(agentWaId, customerWaId);
  await logEvent("customer_message", { waId: customerWaId, agentWaId });

  const codeTag = entry ? `[#${entry.code}] ` : "";
  const namePart = entry?.name ? ` (${entry.name})` : "";
  const msgId = await sendText(agentWaId, `${codeTag}+${customerWaId}${namePart}: ${text}`);
  await conversations.recordOutgoingMessage(msgId, agentWaId, customerWaId);
  return true;
}

async function resolveTargetCustomer(agentWaId, message) {
  const contextId = message.context?.id;
  if (contextId) {
    const mapped = await conversations.lookupByMessageId(contextId);
    if (mapped && mapped.agentWaId === agentWaId) return mapped.customerWaId;
  }

  const text = message.text?.body?.trim() || "";
  const codeMatch = text.match(/^#(\d+)\b/);
  if (codeMatch) {
    const customerWaId = await conversations.getByCode(agentWaId, Number(codeMatch[1]));
    if (customerWaId) return customerWaId;
  }

  return conversations.getMostRecent(agentWaId);
}

function stripCodePrefix(text) {
  return text.replace(/^#\d+\s*/, "");
}

async function relayAgentToCustomer(agentWaId, message) {
  const rawText = message.text?.body?.trim() || "";
  const lower = rawText.toLowerCase();

  if (QUEUE_COMMANDS.includes(lower)) {
    return sendQueueList(agentWaId);
  }

  const closeMatch = lower.match(/^\/close\s*(\d+)?$/) || (CLOSE_COMMANDS.includes(lower) ? [lower] : null);
  if (closeMatch) {
    const codeArg = closeMatch[1] ? Number(closeMatch[1]) : null;
    const targetCustomer = codeArg
      ? await conversations.getByCode(agentWaId, codeArg)
      : await resolveTargetCustomer(agentWaId, message);
    return closeHandoff(agentWaId, targetCustomer);
  }

  const customerWaId = await resolveTargetCustomer(agentWaId, message);
  if (!customerWaId) {
    await sendText(
      agentWaId,
      "⚠️ No active customer to reply to. Send \"/queue\" to see who's waiting, or quote a customer's message to target them."
    );
    return;
  }

  await logEvent("agent_message", { waId: customerWaId, agentWaId });
  await sendText(customerWaId, stripCodePrefix(rawText));
}

async function sendQueueList(agentWaId) {
  const queue = await conversations.listQueue(agentWaId);
  if (queue.length === 0) {
    await sendText(agentWaId, "No active conversations right now.");
    return;
  }
  const lines = queue.map((entry) => {
    const namePart = entry.name ? ` (${entry.name})` : "";
    const mins = Math.round((Date.now() - entry.startedAt) / 60000);
    return `#${entry.code} — +${entry.customerWaId}${namePart} — waiting ${mins}m`;
  });
  await sendText(agentWaId, `Active conversations:\n${lines.join("\n")}`);
}

/**
 * Ends the handoff for a specific customer. Reads the QueueEntry BEFORE
 * removing it so we can log the queue type and total handle time —
 * removeFromQueue deletes the row entirely, it's not soft-deleted.
 */
async function closeHandoff(agentWaId, customerWaId) {
  if (!customerWaId) {
    await sendText(agentWaId, "No matching conversation to close. Send \"/queue\" to see active ones.");
    return;
  }

  const entry = await conversations.getEntry(agentWaId, customerWaId);
  await conversations.removeFromQueue(agentWaId, customerWaId);
  await setSession(customerWaId, { mode: "bot", handoffTo: null, handoffQueue: null });

  if (entry) {
    await logEvent("handoff_closed", {
      waId: customerWaId,
      agentWaId,
      meta: { queue: entry.queueType, durationMs: Date.now() - entry.startedAt.getTime() },
    });
  }

  await sendText(customerWaId, "Thanks for chatting with us! Back to the main menu 👇");
  await sendList(customerWaId, menus.mainMenu);

  const remaining = await conversations.listQueue(agentWaId);
  const remainingNote = remaining.length
    ? ` You still have ${remaining.length} waiting — send "/queue" to see them.`
    : "";
  await sendText(agentWaId, `Conversation with +${customerWaId} closed.${remainingNote}`);
}

async function customerExitsHandoff(customerWaId) {
  const session = await getSession(customerWaId);
  const agentWaId = session.handoffTo;

  await setSession(customerWaId, { mode: "bot", handoffTo: null, handoffQueue: null });
  if (agentWaId) {
    await conversations.removeFromQueue(agentWaId, customerWaId);
    await sendText(agentWaId, `ℹ️ +${customerWaId} returned to the main menu — conversation ended.`);
  }
}

module.exports = {
  isAgentNumber,
  startHandoff,
  relayCustomerToAgent,
  relayAgentToCustomer,
  closeHandoff,
  customerExitsHandoff,
};