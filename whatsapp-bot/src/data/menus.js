/**
 * All menu content lives here. Edit this file to change wording, options,
 * or add new branches — you shouldn't need to touch the routing logic
 * in services/menu.js for most content changes.
 *
 * Each interactive LIST message needs:
 *  - header/body/footer text
 *  - a button label (what the user taps to open the list)
 *  - sections -> rows (each row needs a unique "id" used to route the reply)
 */

const BUSINESS_NAME = "TFS Vryheid";

module.exports = {
  BUSINESS_NAME,

  // Shown once, then whenever the user types something like "hi" or "menu"
  welcomeText:
    `Welcome to the ${BUSINESS_NAME} Main Menu 👋 Select from the options below 🔢\n\n` +
    `To place an order, select the first option.`,

  mainMenu: {
    id: "main_menu",
    header: "Main Menu",
    body: `Welcome to the ${BUSINESS_NAME} Main Menu 👋`,
    footer: "Tap to select an item",
    buttonText: "Main Menu",
    sections: [
      {
        title: "Options",
        rows: [
          { id: "order", title: "Place an order 📝🚗", description: "" },
          { id: "promotions", title: "Promotions 💥", description: "" },
          { id: "location", title: "Location 📍", description: "" },
          { id: "support", title: "Customer support 🏬", description: "" },
          { id: "specials", title: "Daily specials 🥳", description: "" },
        ],
      },
    ],
  },

  promotionsMenu: {
    id: "promotions_menu",
    header: "Promotions 💥",
    body: "Please choose from the options below ⬇️",
    footer: "Tap to select an item",
    buttonText: "Choose Promotion",
    sections: [
      {
        title: "Promotions",
        rows: [
          { id: "retail_promo", title: "Retail Promotion", description: "" },
          { id: "wholesale_promo", title: "Wholesale Promotion", description: "" },
          { id: "main_menu", title: "Main Menu", description: "" },
        ],
      },
    ],
  },

  // Static replies keyed by row id — text-only responses
  textReplies: {
    location:
      "📍 TFS Vryheid\n123 Main Street, Vryheid, KZN\n\nOpen Mon–Sat, 8am–5pm.",
    support:
      "How can we help you?\n\nPlease reply with any request/account query/complaint below, and our support team will receive your message.",
    specials:
      "🥳 Daily specials\nCheck back each morning — today's specials will be posted here.",
    order:
      "Welcome to the TFS Vryheid orders & deliveries on WhatsApp 📝🚗\n\n" +
      "Please give us your name so we know who we're speaking to.\n\n" +
      "If you DO NOT want to place an order, click Main Menu.",
  },

  // Document replies keyed by row id — { caption, filename, mediaPath OR mediaLink }
  documentReplies: {
    retail_promo: {
      caption: "Retail Promotion",
      filename: "Retail Promotion.pdf",
      // mediaLink: "https://yourdomain.com/files/retail-promotion.pdf",
    },
    wholesale_promo: {
      caption: "Wholesale Promotion",
      filename: "Wholesale Promotion.pdf",
      // mediaLink: "https://yourdomain.com/files/wholesale-promotion.pdf",
    },
  },

  fallbackText:
    "Sorry, I didn't understand that 🤔 Type \"menu\" to see the options again.",
};
