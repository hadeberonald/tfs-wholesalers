const mongoose = require("mongoose");

let connected = false;

async function connectDB() {
  if (connected) return mongoose.connection;

  const uri = process.env.WHATSAPP_MONGODB_URI;
  if (!uri) {
    throw new Error(
      "WHATSAPP_MONGODB_URI is not set. Add it to your .env (see .env.example) — " +
        "get it from MongoDB Atlas: Database → Connect → Drivers → Node.js."
    );
  }

  await mongoose.connect(uri, {
    // sensible defaults; bump if you see timeouts on a slow/free-tier cluster
    serverSelectionTimeoutMS: 10000,
  });
  connected = true;
  console.log("MongoDB connected.");
  return mongoose.connection;
}

module.exports = { connectDB };
