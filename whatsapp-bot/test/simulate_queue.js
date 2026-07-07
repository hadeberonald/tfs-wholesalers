process.env.ORDERS_AGENT_NUMBER = "27811110001";
process.env.SUPPORT_AGENT_NUMBER = "27811110002";

const { installFakeModels } = require("./mocks/installFakeModels");
installFakeModels();

const whatsapp = require("../src/services/whatsapp");
let msgCounter = 0;
const log = [];
whatsapp.sendText = async (to, body) => {
  const id = `wamid.FAKE${++msgCounter}`;
  log.push({ fn: "sendText", to, body, id });
  return id;
};
whatsapp.sendList = async (to, menuDef) => {
  const id = `wamid.FAKE${++msgCounter}`;
  log.push({ fn: "sendList", to, header: menuDef.header, id });
  return id;
};
whatsapp.sendDocument = async (to, doc) => {
  const id = `wamid.FAKE${++msgCounter}`;
  log.push({ fn: "sendDocument", to, caption: doc.caption, id });
  return id;
};

const handoff = require("../src/services/handoff");
const { handleIncomingMessage } = require("../src/services/menuRouter");

function textMsg(from, text, contextId = null) {
  const msg = { from, type: "text", text: { body: text } };
  if (contextId) msg.context = { id: contextId };
  return msg;
}
function listReply(from, id) {
  return { from, type: "interactive", interactive: { type: "list_reply", list_reply: { id } } };
}

async function run() {
  const SUPPORT_AGENT = process.env.SUPPORT_AGENT_NUMBER;
  const CUST_A = "27735550001"; // Sipho
  const CUST_B = "27735550002"; // Nomvula

  console.log("\n=== Two customers hit Support at roughly the same time ===");
  await handleIncomingMessage(CUST_A, textMsg(CUST_A, "hi"));
  await handleIncomingMessage(CUST_A, listReply(CUST_A, "support"));
  await handleIncomingMessage(CUST_A, textMsg(CUST_A, "My delivery is late"));

  await handleIncomingMessage(CUST_B, textMsg(CUST_B, "hi"));
  await handleIncomingMessage(CUST_B, listReply(CUST_B, "support"));
  await handleIncomingMessage(CUST_B, textMsg(CUST_B, "Do you have size 8 boots in stock?"));

  console.log("\n=== Agent checks the queue ===");
  await handoff.relayAgentToCustomer(SUPPORT_AGENT, textMsg(SUPPORT_AGENT, "/queue"));

  console.log("\n=== Agent replies WITHOUT quoting (should go to most-recent = Nomvula/CUST_B) ===");
  await handoff.relayAgentToCustomer(SUPPORT_AGENT, textMsg(SUPPORT_AGENT, "Yes, size 8 is in stock!"));

  console.log("\n=== Customer A (Sipho) sends another message, becoming most-recent again ===");
  await handleIncomingMessage(CUST_A, textMsg(CUST_A, "Any update?"));

  console.log("\n=== Agent now quotes Nomvula's ORIGINAL message specifically, to reply to her despite Sipho being most-recent ===");
  const quoteTarget = log.find((e) => e.to === SUPPORT_AGENT && e.body.includes("size 8 boots"))?.id;
  await handoff.relayAgentToCustomer(
    SUPPORT_AGENT,
    textMsg(SUPPORT_AGENT, "Also — we have it in black and tan.", quoteTarget)
  );

  console.log("\n=== Agent closes Sipho specifically by code (without quoting) ===");
  await handoff.relayAgentToCustomer(SUPPORT_AGENT, textMsg(SUPPORT_AGENT, "/close 1"));

  console.log("\n=== Agent checks queue again — only Nomvula should remain ===");
  await handoff.relayAgentToCustomer(SUPPORT_AGENT, textMsg(SUPPORT_AGENT, "/queue"));

  console.log("\n=== Nomvula bails out by typing 'menu' herself ===");
  await handleIncomingMessage(CUST_B, textMsg(CUST_B, "menu"));

  console.log("\n=== Agent checks queue — should now be empty ===");
  await handoff.relayAgentToCustomer(SUPPORT_AGENT, textMsg(SUPPORT_AGENT, "/queue"));

  console.log("\n\n--- FULL LOG ---");
  log.forEach((entry, i) => {
    console.log(`${i + 1}. [${entry.fn}] -> ${entry.to}  (${entry.id})`);
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
