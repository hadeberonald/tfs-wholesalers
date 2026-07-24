// services/menuRouter.js — full file, with logEvent calls added
const {
  sendText,
  sendList,
  sendDocument,
  uploadMediaFromUrl,
  inferMimeType,
} = require("./whatsapp");
const { getSession, setSession } = require("./sessionStore");
const handoff = require("./handoff");
const { logEvent } = require("./analytics");
const PromoDocument = require("../models/PromoDocument");
const { getMessage, buildMainMenu, buildPromotionsMenu } = require("./messages");

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

async function sendPromoDocument(waId, key, fallbackText) {
  const doc = await PromoDocument.findOne({ key }).lean();
  if (!doc) {
    await logEvent("promo_fallback", { waId, meta: { key, reason: "not_uploaded" } });
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
    await logEvent("promo_sent", { waId, meta: { key } });
  } catch (err) {
    console.error(`sendPromoDocument failed for key="${key}": ${err.message || err}`);
    await logEvent("promo_fallback", { waId, meta: { key, reason: "send_failed" } });
    await sendText(
      waId,
      "Sorry, we couldn't send that file right now. Please try again shortly, or type \"menu\" to go back."
    );
  }
}

async function handleIncomingMessage(waId, message) {
  const selection = extractSelection(message);
  const session = await getSession(waId);

  if (selection.kind === "text" && MENU_OVERRIDE_WORDS.includes(selection.value.toLowerCase())) {
    if (session.mode === "handoff") {
      await handoff.customerExitsHandoff(waId);
    }
    await logEvent("menu_viewed", { waId });
    await sendList(waId, await buildMainMenu());
    await setSession(waId, { currentMenu: "main_menu" });
    return;
  }

  if (session.mode === "handoff") {
    if (selection.kind === "text") {
      await handoff.relayCustomerToAgent(waId, selection.value);
    }
    return;
  }

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

  if (selection.kind === "text" && GREETING_WORDS.includes(selection.value.toLowerCase())) {
    await logEvent("menu_viewed", { waId });
    await sendText(waId, await getMessage("welcome_text"));
    await sendList(waId, await buildMainMenu());
    await setSession(waId, { currentMenu: "main_menu" });
    return;
  }

  if (selection.kind === "list_reply") {
    await routeRowSelection(waId, selection.id);
    return;
  }

  await logEvent("fallback_triggered", {
    waId,
    meta: { text: selection.kind === "text" ? selection.value : null },
  });
  await sendText(waId, await getMessage("fallback_text"));
  await sendList(waId, await buildMainMenu());
}

async function routeRowSelection(waId, rowId) {
  await logEvent("menu_row_selected", { waId, meta: { rowId } });

  switch (rowId) {
    case "main_menu":
      await sendList(waId, await buildMainMenu());
      await setSession(waId, { currentMenu: "main_menu" });
      return;

    case "promotions":
      await sendList(waId, await buildPromotionsMenu());
      await setSession(waId, { currentMenu: "promotions_menu" });
      return;

    case "retail_promo":
    case "wholesale_promo": {
      const fallbackKey = rowId === "retail_promo" ? "retail_promo_fallback_text" : "wholesale_promo_fallback_text";
      const fallback = await getMessage(fallbackKey);
      await sendPromoDocument(waId, rowId, fallback);
      await sendList(waId, await buildMainMenu());
      await setSession(waId, { currentMenu: "main_menu" });
      return;
    }

    case "order":
      await logEvent("order_started", { waId });
      await sendText(waId, await getMessage("order_text"));
      await setSession(waId, { currentMenu: "awaiting_order_name" });
      return;

    case "support":
      await sendText(waId, await getMessage("support_text"));
      await handoff.startHandoff(waId, "support", "Customer requested support from the main menu.");
      return;

    case "specials":
      await sendPromoDocument(waId, "daily_specials", await getMessage("specials_text"));
      await sendList(waId, await buildMainMenu());
      await setSession(waId, { currentMenu: "main_menu" });
      return;

    case "location": {
      await sendText(waId, await getMessage("location_text"));
      await sendList(waId, await buildMainMenu());
      await setSession(waId, { currentMenu: "main_menu" });
      return;
    }

    default:
      await logEvent("fallback_triggered", { waId, meta: { rowId } });
      await sendText(waId, await getMessage("fallback_text"));
      await sendList(waId, await buildMainMenu());
      await setSession(waId, { currentMenu: "main_menu" });
  }
}

module.exports = { handleIncomingMessage };
