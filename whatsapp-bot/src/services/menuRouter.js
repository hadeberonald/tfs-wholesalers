const menus = require("../data/menus");
const {
  sendText,
  sendList,
  sendDocument,
  uploadMediaFromUrl,
  inferMimeType,
} = require("./whatsapp");
const { getSession, setSession } = require("./sessionStore");
const handoff = require("./handoff");
const PromoDocument = require("../models/PromoDocument");

const GREETING_WORDS = ["hi", "hello", "hey", "menu", "start", "hi there"];
const MENU_OVERRIDE_WORDS = ["menu", "main menu"]; // wins even mid-handoff

function extractSelection(message) {
  if (message.type === "interactive" && message.interactive?.type === "list_reply") {
    return { kind: "list_reply", id: message.interactive.list_reply.id };
  }
  if (message.type === "text") {
    return { kind: "text", value: message.text.body.trim() };
  }
  return { kind: "unknown" };
}

/**
 * Sends whichever file an admin most recently uploaded for `key` (via
 * /api/admin/promo-files on the main app), falling back to plain text if
 * nothing has been uploaded yet so this never breaks the menu flow.
 *
 * We download the file from Cloudinary and upload it to Meta's Media API
 * first, then send it by media_id — sending by public `link` directly can
 * silently fail to deliver (Meta's fetcher can reject the URL for reasons
 * that never show up as an error in our own logs), so this is the reliable
 * path. If anything in that chain fails, we log it clearly and let the
 * customer know instead of the message just vanishing.
 */
async function sendPromoDocument(waId, key, fallbackText) {
  const doc = await PromoDocument.findOne({ key }).lean();
  if (!doc) {
    await sendText(waId, fallbackText);
    return;
  }

  try {
    const mimeType = inferMimeType(doc.filename);
    const mediaId = await uploadMediaFromUrl(doc.fileUrl, mimeType, doc.filename);
    await sendDocument(waId, {
      mediaId,
      filename: doc.filename,
      caption: doc.caption || undefined,
    });
  } catch (err) {
    console.error(`sendPromoDocument failed for key="${key}": ${err.message || err}`);
    await sendText(
      waId,
      "Sorry, we couldn't send that file right now. Please try again shortly, or type \"menu\" to go back."
    );
  }
}

/**
 * Main entry point for messages coming FROM CUSTOMERS (agent messages are
 * routed separately in webhook.js, straight to handoff.relayAgentToCustomer).
 */
async function handleIncomingMessage(waId, message) {
  const selection = extractSelection(message);
  const session = await getSession(waId);

  // "menu" always wins, even mid-conversation with a human agent —
  // this is the fix for the "stuck until reset" problem.
  if (selection.kind === "text" && MENU_OVERRIDE_WORDS.includes(selection.value.toLowerCase())) {
    if (session.mode === "handoff") {
      await handoff.customerExitsHandoff(waId);
    }
    await sendList(waId, menus.mainMenu);
    await setSession(waId, { currentMenu: "main_menu" });
    return;
  }

  // While in a human handoff, everything else the customer types just
  // relays straight to whichever agent owns the conversation.
  if (session.mode === "handoff") {
    if (selection.kind === "text") {
      await handoff.relayCustomerToAgent(waId, selection.value);
    }
    return;
  }

  // Mid order-name-capture: the next free text IS their name, not a menu tap
  if (session.currentMenu === "awaiting_order_name" && selection.kind === "text") {
    const name = selection.value;
    await setSession(waId, { orderName: name });
    await handoff.startHandoff(
      waId,
      "orders",
      `Order request from ${name}. Waiting on order details.`,
      { name }
    );
    return;
  }

  // Greeting / explicit "menu" from a fresh bot-mode session
  if (selection.kind === "text" && GREETING_WORDS.includes(selection.value.toLowerCase())) {
    await sendText(waId, menus.welcomeText);
    await sendList(waId, menus.mainMenu);
    await setSession(waId, { currentMenu: "main_menu" });
    return;
  }

  if (selection.kind === "list_reply") {
    await routeRowSelection(waId, selection.id);
    return;
  }

  // Free text with no active flow -> fallback
  await sendText(waId, menus.fallbackText);
  await sendList(waId, menus.mainMenu);
}

async function routeRowSelection(waId, rowId) {
  switch (rowId) {
    case "main_menu":
      await sendList(waId, menus.mainMenu);
      await setSession(waId, { currentMenu: "main_menu" });
      return;

    case "promotions":
      await sendList(waId, menus.promotionsMenu);
      await setSession(waId, { currentMenu: "promotions_menu" });
      return;

    case "retail_promo":
    case "wholesale_promo": {
      const fallback =
        menus.textReplies[rowId] ||
        "Sorry, this promotion isn't available right now. Please check back soon.";
      await sendPromoDocument(waId, rowId, fallback);
      await sendList(waId, menus.mainMenu);
      await setSession(waId, { currentMenu: "main_menu" });
      return;
    }

    // Order flow starts here — ask for name, wait for the reply as free text
    case "order":
      await sendText(waId, menus.textReplies.order);
      await setSession(waId, { currentMenu: "awaiting_order_name" });
      return;

    // Support hands off immediately — no menu prompt needed first
    case "support":
      await sendText(waId, menus.textReplies.support);
      await handoff.startHandoff(waId, "support", "Customer requested support from the main menu.");
      return;

    case "specials":
      await sendPromoDocument(waId, "daily_specials", menus.textReplies.specials);
      await sendList(waId, menus.mainMenu);
      await setSession(waId, { currentMenu: "main_menu" });
      return;

    case "location": {
      await sendText(waId, menus.textReplies.location || menus.fallbackText);
      await sendList(waId, menus.mainMenu);
      await setSession(waId, { currentMenu: "main_menu" });
      return;
    }

    default:
      await sendText(waId, menus.fallbackText);
      await sendList(waId, menus.mainMenu);
      await setSession(waId, { currentMenu: "main_menu" });
  }
}

module.exports = { handleIncomingMessage };
