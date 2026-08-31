const mongoose = require("mongoose");

/**
 * Ladysmith's own connection, isolated from Dundee's.
 *
 * IMPORTANT: unlike whatsapp-bot's db.js, this must NOT call
 * mongoose.connect() — that call operates on Mongoose's single global
 * default connection. Since whatsapp-bot's db.js is also required in the
 * same Node process (server.ts mounts both bots), a second connect() call
 * here would silently redirect Dundee's connection to Ladysmith's database
 * instead of opening a second one.
 *
 * mongoose.createConnection() instead opens a genuinely separate connection
 * object. Every model in this folder compiles against `getConnection()`
 * (see models/*.js) rather than the bare `mongoose.model()` used in
 * whatsapp-bot, so Ladysmith's data never touches Dundee's connection.
 */
let conn = null;

function getConnection() {
  if (conn) return conn;

  const uri = process.env.WHATSAPP_MONGODB_URI_2;
  if (!uri) {
    throw new Error(
      "WHATSAPP_MONGODB_URI_2 is not set. This is Ladysmith's own database " +
        "URI — separate from Dundee's WHATSAPP_MONGODB_URI. Add it to your " +
        ".env (see .env.example) — get it from MongoDB Atlas: Database → " +
        "Connect → Drivers → Node.js."
    );
  }

  // createConnection() returns immediately and buffers commands until the
  // connection opens, same as mongoose.connect() does for the default
  // connection — so it's safe to call getConnection().model(...) at module
  // load time in models/*.js, before connectDB() below has resolved.
  conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  return conn;
}

async function connectDB() {
  const connection = getConnection();
  if (connection.readyState === 1) return connection;
  await connection.asPromise();
  console.log("MongoDB connected (Ladysmith).");
  return connection;
}

module.exports = { connectDB, getConnection };
