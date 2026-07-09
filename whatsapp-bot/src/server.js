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

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`Webhook URL to give Meta: https://<your-domain>/webhook`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB — server not started.", err.message);
    process.exit(1);
  });
