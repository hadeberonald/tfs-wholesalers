require("dotenv").config();
const express = require("express");
const webhookRoute = require("./routes/webhook");
const analyticsRoute = require("./routes/analytics");
const { connectDB } = require("./config/db");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WhatsApp bot server is running.");
});

app.use("/webhook", webhookRoute);
app.use("/analytics", analyticsRoute);

// Only used when running this folder standalone (not mounted via the root
// server.ts). PORT_2 avoids clashing with Dundee's PORT if both standalone
// servers are ever run side by side on the same machine.
const PORT = process.env.PORT_2 || process.env.PORT || 3001;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ladysmith bot server listening on port ${PORT}`);
      console.log(`Webhook URL to give Meta: https://<your-domain>/webhook`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB — server not started.", err.message);
    process.exit(1);
  });
