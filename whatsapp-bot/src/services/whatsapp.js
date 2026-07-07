const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  GRAPH_API_VERSION = "v20.0",
} = process.env;

const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`;

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    "Content-Type": "application/json",
  },
});

/**
 * Send a plain text message. Returns the sent message's id (wamid) so
 * callers can remember "this message was about customer X" — needed for
 * the swipe-to-reply routing in the agent handoff queue.
 */
async function sendText(to, body) {
  const res = await client.post("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
  return res.data?.messages?.[0]?.id || null;
}

/**
 * Send an interactive LIST message (the native "Main Menu" popup style).
 * menuDef shape: { header, body, footer, buttonText, sections: [{ title, rows: [{id, title, description}] }] }
 */
async function sendList(to, menuDef) {
  const res = await client.post("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: menuDef.header ? { type: "text", text: menuDef.header } : undefined,
      body: { text: menuDef.body },
      footer: menuDef.footer ? { text: menuDef.footer } : undefined,
      action: {
        button: menuDef.buttonText || "Menu",
        sections: menuDef.sections,
      },
    },
  });
  return res.data?.messages?.[0]?.id || null;
}

/**
 * Upload a local file to Meta's servers and return a media ID,
 * used before sending a document by media ID (as opposed to a public URL).
 */
async function uploadMedia(filePath, mimeType = "application/pdf") {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", fs.createReadStream(filePath), { contentType: mimeType });

  const res = await axios.post(`${BASE_URL}/media`, form, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      ...form.getHeaders(),
    },
  });
  return res.data.id; // media_id
}

/**
 * Send a document either by a public mediaLink URL, or by mediaId
 * (from uploadMedia) if you're hosting the PDF privately.
 */
async function sendDocument(to, { mediaLink, mediaId, filename, caption }) {
  const documentPayload = filename ? { filename } : {};
  if (caption) documentPayload.caption = caption;
  if (mediaLink) documentPayload.link = mediaLink;
  if (mediaId) documentPayload.id = mediaId;

  const res = await client.post("/messages", {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: documentPayload,
  });
  return res.data?.messages?.[0]?.id || null;
}

/**
 * Mark an incoming message as read (blue ticks) — optional, nice UX touch.
 */
async function markAsRead(messageId) {
  return client.post("/messages", {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

module.exports = { sendText, sendList, sendDocument, uploadMedia, markAsRead };
