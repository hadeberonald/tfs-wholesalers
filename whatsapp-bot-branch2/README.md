# WhatsApp Cloud API Bot — TFS Vryheid Prototype

A Node.js/Express bot replicating an interactive list-menu flow (Main Menu →
Promotions → Retail/Wholesale PDF) using WhatsApp's native list messages.

## 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env` with the values from your Meta App Dashboard → WhatsApp → API Setup:
- `WHATSAPP_TOKEN` — the temporary token shown there (swap for a permanent
  System User token later)
- `WHATSAPP_PHONE_NUMBER_ID` — shown on the same page
- `VERIFY_TOKEN` — make up any string; you'll enter this same string in
  Meta's webhook config
- `MONGODB_URI` — the client's MongoDB Atlas connection string (see section 7)
- `ORDERS_AGENT_NUMBER` / `SUPPORT_AGENT_NUMBER` — the agents' real WhatsApp
  numbers, digits only, no `+` (see section 8)

## 2. Run locally

```bash
npm start
```

Server starts on `http://localhost:3000`. Meta needs a public HTTPS URL to
reach your webhook, so for local testing use a tunnel:

```bash
npx ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL ngrok gives you.

## 3. Configure the webhook in Meta

1. App Dashboard → WhatsApp → Configuration
2. Callback URL: `https://xxxx.ngrok-free.app/webhook`
3. Verify token: same string as `VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**
5. Subscribe to the `messages` field

## 4. Test it

From the test number's allowed recipient list (Meta App Dashboard → API
Setup → "To" field, add your own number), message the test number "Hi" on
WhatsApp. You should get the welcome text + the Main Menu list.

## 5. Adding the actual PDF files

Two options in `src/data/menus.js` under `documentReplies`:

- **Public URL** — host the PDF anywhere public (even a GitHub raw link
  works for testing) and set `mediaLink: "https://.../file.pdf"`
- **Private upload** — call `uploadMedia(filePath)` from
  `src/services/whatsapp.js` once to get a `mediaId`, then hardcode that ID
  as `mediaId` in `menus.js`. Media IDs don't expire quickly but do get
  cleaned up eventually, so `mediaLink` is simpler for anything long-lived.

## 6. Editing menu content

Everything user-facing — menu text, options, replies — lives in
`src/data/menus.js`. You generally shouldn't need to touch
`src/services/menuRouter.js` unless you're adding a new *type* of branch
(e.g., a third-level submenu).

## 7. MongoDB setup (persists sessions and the agent queue)

Session state and the agent handoff queue now live in MongoDB instead of
in-memory, so they survive server restarts and work correctly even if you
scale to multiple server instances.

**Get your connection string:**
1. In MongoDB Atlas, open the client's project → **Database** → click
   **Connect** on the relevant cluster → **Drivers** → **Node.js**
2. Copy the connection string — looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`
3. Add a database name at the end if it's not already there, e.g.
   `.../whatsapp-bot?retryWrites=true...`
4. Paste the whole thing into `.env` as `MONGODB_URI`

**Network access:** Atlas needs to allow connections from wherever the bot
runs. Under **Network Access** in Atlas, add your current IP for local
testing, and Render's outbound IPs (or `0.0.0.0/0` for simplicity while
testing — tighten this before going to production) once deployed.

**What's stored, in three small collections:**

| Collection | Model | Purpose |
|---|---|---|
| `sessions` | `src/models/Session.js` | one doc per customer — current menu, bot/handoff mode |
| `queueentries` | `src/models/QueueEntry.js` | one doc per customer currently waiting on an agent, with their `#code` |
| `messageindices` | `src/models/MessageIndex.js` | maps outgoing WhatsApp message IDs → customer, for quote-reply routing (auto-expires after 7 days) |
| `counters` | `src/models/Counter.js` | atomic sequence numbers for `#codes` and "most recent" ordering |

**Testing without touching the real database:** `test/simulate.js` and
`test/simulate_queue.js` use a lightweight in-memory fake of the Mongoose
model calls (`test/mocks/`), so you can verify logic changes instantly and
offline — no real MongoDB connection needed for those. The actual server
(`npm start`) always uses the real `MONGODB_URI` from `.env`.

```bash
npm test   # runs both simulate scripts against the fake in-memory store
```

## 8. Human handoff with multi-customer queueing

"Place an order" and "Customer support" connect the customer to a real
person on the agent's own WhatsApp number, while the customer keeps chatting
with the same bot number throughout. Agents can handle **several customers
at once** — this isn't limited to one conversation per agent.

**Setup:** set `ORDERS_AGENT_NUMBER` / `SUPPORT_AGENT_NUMBER` in `.env`
(wa_id format: digits only, no `+`, e.g. `27735720641`).

**How an agent works multiple conversations at once:**

- Every message relayed to the agent is tagged with a short code, e.g.
  `[#3] +27735550002 (Nomvula): Do you have size 8 in stock?`
- **To reply to a specific customer:** swipe-to-reply (quote) that exact
  message in WhatsApp before typing the answer. This is the reliable way —
  it works no matter how many other conversations are also active.
- **If the agent doesn't quote anything,** the reply goes to whichever
  customer they most recently exchanged a message with — convenient when
  only one conversation is active, but ambiguous with several going at
  once, so quoting is the recommended habit once there's more than one.
- **`/queue`** (or `/list`, `/who`) — lists every customer currently
  waiting on that agent, with their code, name (if captured), and how long
  they've been waiting.
- **`/close`** — ends whichever conversation is currently "most recent" (or
  quote a customer's message and send `/close` to end that one specifically).
- **`/close 3`** — ends conversation `#3` directly, no quoting needed.
- Closing sends the customer back to the main menu and tells the agent how
  many others are still waiting, if any.

**The customer can always type "menu"** to bail out immediately, even
mid-conversation with an agent — this closes their side of the handoff and
notifies the agent that the customer left, so no one gets stuck (this was
the original bug from early testing — now fixed on both the agent-close and
customer-exit paths).

**Test the whole thing without spending real WhatsApp messages:**

```bash
node test/simulate.js         # single-customer flow, order + support
node test/simulate_queue.js   # two simultaneous customers, quote-routing,
                               # /queue, /close by code — this is the one
                               # that proves the queue actually works
```

`simulate_queue.js` specifically demonstrates the agent quoting an older
message to correctly reply to a customer who ISN'T the most-recent one —
read through its printed log to see the routing decision happen at each step.

**Current limitation:** all queue/session state is in-memory (see section 8)
— fine for one server instance during testing, but won't survive a restart
or work across multiple server instances until it's moved to a database.

## 9. Known limitations of this prototype

- **No message logging/analytics yet** — add a `Conversation` model if you
  want to track what people are asking.
- **Temporary token expires in 24h** — generate a permanent System User
  token before going further than a day of testing.
- **Per-agent `#code` and recency counters are per-name in MongoDB, not
  per-agent-array-indexed** — fine at this scale; if you have dozens of
  agents this still works the same way, nothing to change.

## 10. Next steps once this is stable

- Deploy to Render, point Meta's webhook at the live URL instead of ngrok, and set `MONGODB_URI` in Render's environment variables to the client's real Atlas connection string
- Generate the permanent System User token
- Add real PDF files and confirm delivery
- Tighten Atlas Network Access from `0.0.0.0/0` (if used for testing) down to Render's actual outbound IPs before going live
- Consider a proper ticket/routing system if agent volume grows beyond what
  the code-and-quote system comfortably handles
