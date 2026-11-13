const mongoose = require("mongoose");
const env = require("./env");

let connecting = null;
let supportsTransactions = false;

// Connects once and caches the promise (safe for serverless warm starts).
async function connectDB(uri = env.MONGO_URI) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!uri) throw new Error("MONGO_URI is not set");
  if (!connecting) {
    connecting = mongoose
      .connect(uri, { autoIndex: true })
      .then(async (m) => {
        try {
          const hello = await m.connection.db.admin().command({ hello: 1 });
          supportsTransactions = Boolean(hello.setName || hello.msg === "isdbgrid");
        } catch {
          supportsTransactions = false;
        }
        if (!env.isTest) {
          console.log(
            `MongoDB connected (${m.connection.host}); transactions ${supportsTransactions ? "enabled" : "unavailable"}`
          );
        }
        return m.connection;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

async function disconnectDB() {
  connecting = null;
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, transactionsSupported: () => supportsTransactions };
