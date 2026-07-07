/**
 * Human agent numbers, in WhatsApp wa_id format (digits only, no +, no spaces).
 * e.g. South African number +27 73 572 0641 -> "27735720641"
 *
 * Each "queue" is a single agent number for now. If you later want a team
 * inbox rather than one phone per queue, replace this with a proper
 * ticket/routing system — this is deliberately the simplest version that works.
 */

module.exports = {
  ORDERS_AGENT: process.env.ORDERS_AGENT_NUMBER || "27000000001",
  SUPPORT_AGENT: process.env.SUPPORT_AGENT_NUMBER || "27000000002",

  // Any of these agent numbers, typed as a message BY the agent, hands the
  // customer back to the bot and shows them the main menu again.
  CLOSE_COMMANDS: ["/close", "/end", "/menu", "close chat", "done"],
};
