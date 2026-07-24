// services/messages.js — resolves the current text for each editable bot
// message, preferring an admin override (BotMessage collection) and falling
// back to the default baked into data/menus.js.
const menus = require("../data/menus");
const BotMessage = require("../models/BotMessage");

// Reads the default straight out of menus.js (rather than copying the
// strings here) so the two stay in sync automatically.
const DEFAULTS = {
  welcome_text: () => menus.welcomeText,
  main_menu_body: () => menus.mainMenu.body,
  promotions_menu_body: () => menus.promotionsMenu.body,
  location_text: () => menus.textReplies.location,
  support_text: () => menus.textReplies.support,
  specials_text: () => menus.textReplies.specials,
  retail_promo_fallback_text: () => menus.textReplies.retail_promo,
  wholesale_promo_fallback_text: () => menus.textReplies.wholesale_promo,
  order_text: () => menus.textReplies.order,
  fallback_text: () => menus.fallbackText,
};

let cache = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000; // admin edits show up within 30s without a redeploy

async function loadOverrides() {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  const docs = await BotMessage.find({}).lean();
  cache = {};
  docs.forEach((d) => {
    cache[d.key] = d.value;
  });
  cachedAt = Date.now();
  return cache;
}

/**
 * Returns the current text for `key` — the admin-saved override if one
 * exists, otherwise the default from menus.js.
 */
async function getMessage(key) {
  if (!DEFAULTS[key]) throw new Error(`Unknown bot message key: ${key}`);
  try {
    const overrides = await loadOverrides();
    if (overrides[key] !== undefined) return overrides[key];
  } catch (err) {
    console.error(`getMessage("${key}") override lookup failed, using default:`, err.message || err);
  }
  return DEFAULTS[key]();
}

/** Returns a copy of menus.mainMenu with its body replaced by the current override (if any). */
async function buildMainMenu() {
  return { ...menus.mainMenu, body: await getMessage("main_menu_body") };
}

/** Returns a copy of menus.promotionsMenu with its body replaced by the current override (if any). */
async function buildPromotionsMenu() {
  return { ...menus.promotionsMenu, body: await getMessage("promotions_menu_body") };
}

/** Call right after an admin save so the next send picks up the change immediately instead of waiting for the cache to expire. */
function invalidateCache() {
  cache = null;
}

module.exports = { getMessage, buildMainMenu, buildPromotionsMenu, invalidateCache };
