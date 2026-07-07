const { sendText, sendList } = require("./whatsapp");
const { getSession, setSession } = require("./sessionStore");
const conversations = require("./conversationStore");
const { ORDERS_AGENT, SUPPORT_AGENT, CLOSE_COMMANDS } = require("../config/agents");
const menus = require("../data/menus");

const AGENT_NUMBERS = new Set([ORDERS_AGENT, SUPPORT_AGENT]);
const QUEUE_COMMANDS = ["/queue", "/list", "/who"];

function isAgentNumber(waId) {
  return AGENT_NUMBERS.has(waId);
}

/**
 * Starts a handoff: notifies the agent (with a #code identifying this
 * conversation), puts the customer's session into "handoff" mode, and adds
 * them to that agent's queue.
 */
async function startHandoff(customerWaId, queue, contextLine, meta = {}) {
  const agentWaId = queue === "orders" ? ORDERS_AGENT : SUPPORT_AGENT;

  const entry = await conversations.addToQueue(agentWaId, customerWaId, { queueType: queue, ...meta });
  await setSession(customerWaId, { mode: "handoff", handoffTo: agentWaId, handoffQueue: queue });

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

/**
 * Customer sent a message while in handoff mode — relay it to whichever
 * agent owns their conversation, tagged with their #code so the agent can
 * tell whose message it is even with several chats going at once.
 */
async function relayCustomerToAgent(customerWaId, text) {
  const session = await getSession(customerWaId);
  const agentWaId = session.handoffTo;
  if (!agentWaId) return false; // not actually in handoff, let caller fall through

  const entry = await conversations.getEntry(agentWaId, customerWaId);
  await conversations.setMostRecent(agentWaId, customerWaId);

  const codeTag = entry ? `[#${entry.code}] ` : "";
  const namePart = entry?.name ? ` (${entry.name})` : "";
  const msgId = await sendText(agentWaId, `${codeTag}+${customerWaId}${namePart}: ${text}`);
  await conversations.recordOutgoingMessage(msgId, agentWaId, customerWaId);
  return true;
}

/**
 * Figures out which customer an agent's incoming message is meant for.
 * Priority: quoted message (context.id) > explicit "#N " prefix in the text
 * > whichever customer they most recently exchanged a message with.
 */
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

/** Strips a leading "#3 " tag from agent text before relaying to the customer. */
function stripCodePrefix(text) {
  return text.replace(/^#\d+\s*/, "");
}

/**
 * Agent sent a message — route it to the right customer, or handle it as
 * a command (/queue, /close, /close N).
 */
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
 * Ends the handoff for a specific customer, sends them back to the main
 * menu, and removes them from the agent's queue. If the agent still has
 * others waiting, lets them know.
 */
async function closeHandoff(agentWaId, customerWaId) {
  if (!customerWaId) {
    await sendText(agentWaId, "No matching conversation to close. Send \"/queue\" to see active ones.");
    return;
  }

  await conversations.removeFromQueue(agentWaId, customerWaId);
  await setSession(customerWaId, { mode: "bot", handoffTo: null, handoffQueue: null });

  await sendText(customerWaId, "Thanks for chatting with us! Back to the main menu 👇");
  await sendList(customerWaId, menus.mainMenu);

  const remaining = await conversations.listQueue(agentWaId);
  const remainingNote = remaining.length
    ? ` You still have ${remaining.length} waiting — send "/queue" to see them.`
    : "";
  await sendText(agentWaId, `Conversation with +${customerWaId} closed.${remainingNote}`);
}

/**
 * Customer explicitly typed something like "menu" while in handoff —
 * this always wins, even mid human-conversation, so no one gets stuck.
 */
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
