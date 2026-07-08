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
 * Download a file from a public URL (e.g. a Cloudinary secure_url) and
 * upload it straight to Meta's Media API, returning a media_id.
 *
 * Prefer this over sending documents by public `link` — link-based delivery
 * can silently fail to reach the customer if Meta's fetcher can't retrieve
 * the URL cleanly (redirects, unexpected Content-Type, etc.), and that
 * failure never surfaces as an error in our logs since the initial
 * /messages call still returns 200 regardless. Uploading the bytes
 * directly to Meta first avoids that whole class of failure.
 */
async function uploadMediaFromUrl(url, mimeType, filename) {
  let downloadRes;
  try {
    downloadRes = await axios.get(url, {
      responseType: "arraybuffer",
      // Cloudinary (and some hosts) return an HTML/JSON error body with a
      // non-2xx status instead of throwing at the network layer — treat
      // that the same as a thrown error so it's caught below.
      validateStatus: (status) => status >= 200 && status < 300,
    });
  } catch (err) {
    // When responseType is "arraybuffer", axios puts the ERROR body in the
    // same format too — so err.response.data is a raw Buffer, not JSON,
    // and logging it directly just prints an unreadable "<Buffer ...>".
    // Decode it back to text so the real message (e.g. Cloudinary's
    // "401 Unauthorized: PDF/ZIP delivery disabled") is actually visible.
    const raw = err.response?.data;
    const readable = Buffer.isBuffer(raw) ? raw.toString("utf-8").slice(0, 500) : err.message;
    throw new Error(
      `Failed to download file from ${url} (status ${err.response?.status || "?"}): ${readable}`
    );
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", Buffer.from(downloadRes.data), {
    contentType: mimeType,
    filename: filename || "file",
  });

  try {
    const res = await axios.post(`${BASE_URL}/media`, form, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        ...form.getHeaders(),
      },
    });
    return res.data.id; // media_id
  } catch (err) {
    throw new Error(
      `Meta media upload failed: ${JSON.stringify(err.response?.data || err.message)}`
    );
  }
}

/**
 * Guess a WhatsApp-acceptable MIME type from a filename's extension —
 * used when we only have a filename (e.g. from the PromoDocument record)
 * and need to tell Meta's Media API what content type it's receiving.
 */
function inferMimeType(filename = "") {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const map = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * Send a document either by a public mediaLink URL, or by mediaId
 * (from uploadMedia / uploadMediaFromUrl) if you're hosting the file privately.
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

module.exports = {
  sendText,
  sendList,
  sendDocument,
  uploadMedia,
  uploadMediaFromUrl,
  inferMimeType,
  markAsRead,
};
