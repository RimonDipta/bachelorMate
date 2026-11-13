const mongoose = require("mongoose");
const { transactionsSupported } = require("../config/db");

/**
 * Runs fn(session) inside a MongoDB transaction when the deployment supports
 * it (replica set / Atlas). On a standalone server it runs without a session,
 * so local development still works; production should use a replica set.
 */
async function withTransaction(fn) {
  if (!transactionsSupported()) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
