process.env.ORDERS_AGENT_NUMBER = "27811110001";
process.env.SUPPORT_AGENT_NUMBER = "27811110002";

const { installFakeModels } = require("./mocks/installFakeModels");
installFakeModels();

// Stub the outgoing WhatsApp API so we see what WOULD be sent, without
// hitting the real Graph API.
const whatsapp = require("../src/services/whatsapp");
const log = [];
whatsapp.sendText = async (to, body) => {
  log.push({ fn: "sendText", to, body });
  return `wamid.FAKE${log.length}`;
};
whatsapp.sendList = async (to, menuDef) => {
  log.push({ fn: "sendList", to, header: menuDef.header });
  return `wamid.FAKE${log.length}`;
};
whatsapp.sendDocument = async (to, doc) => {
  log.push({ fn: "sendDocument", to, caption: doc.caption });
  return `wamid.FAKE${log.length}`;
};

const handoff = require("../src/services/handoff");
const { handleIncomingMessage } = require("../src/services/menuRouter");

function textMsg(from, text) {
  return { from, type: "text", text: { body: text } };
}
function listReply(from, id) {
  return { from, type: "interactive", interactive: { type: "list_reply", list_reply: { id } } };
}

async function run() {
  const CUSTOMER = "27735550000";
  const SUPPORT_AGENT = process.env.SUPPORT_AGENT_NUMBER;
  const ORDERS_AGENT = process.env.ORDERS_AGENT_NUMBER;

  console.log("\n=== SCENARIO 1: Customer support handoff + agent reply + customer exits via 'menu' ===");
  await handleIncomingMessage(CUSTOMER, textMsg(CUSTOMER, "Hi"));
  await handleIncomingMessage(CUSTOMER, listReply(CUSTOMER, "support"));
  await handleIncomingMessage(CUSTOMER, textMsg(CUSTOMER, "Is my invoice #4521 overdue?"));
  await handoff.relayAgentToCustomer(SUPPORT_AGENT, textMsg(SUPPORT_AGENT, "Hi! Let me check that for you."));
  await handleIncomingMessage(CUSTOMER, textMsg(CUSTOMER, "menu"));

  console.log("\n=== SCENARIO 2: Place an order flow (name capture -> handoff to orders agent) ===");
  const CUSTOMER2 = "27735550001";
  await handleIncomingMessage(CUSTOMER2, textMsg(CUSTOMER2, "hi"));
  await handleIncomingMessage(CUSTOMER2, listReply(CUSTOMER2, "order"));
  await handleIncomingMessage(CUSTOMER2, textMsg(CUSTOMER2, "John Doe"));
  await handleIncomingMessage(CUSTOMER2, textMsg(CUSTOMER2, "I need 10 bags of maize meal"));
  await handoff.relayAgentToCustomer(ORDERS_AGENT, textMsg(ORDERS_AGENT, "/menu"));

  console.log("\n=== SCENARIO 3: Agent tries to reply with no active customer ===");
  await handoff.relayAgentToCustomer(ORDERS_AGENT, textMsg(ORDERS_AGENT, "hello?"));

  console.log("\n\n--- FULL LOG ---");
  log.forEach((entry, i) => {
    console.log(`${i + 1}. [${entry.fn}] -> ${entry.to}`);
    if (entry.body) console.log(`   "${entry.body}"`);
    if (entry.header) console.log(`   (list: ${entry.header})`);
    if (entry.caption) console.log(`   (document: ${entry.caption})`);
  });
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("SIMULATION ERROR:", e);
    process.exit(1);
  });
