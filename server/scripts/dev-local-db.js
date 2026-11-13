/*
 * Development convenience: runs the API against a local single-node MongoDB
 * replica set (downloaded automatically by mongodb-memory-server), so you can
 * try BachelorMate without installing MongoDB. Data persists in server/.dev-db.
 *
 *   npm run dev:local
 *
 * Use a real MONGO_URI (Atlas or your own replica set) for production.
 */
const path = require("path");
const fs = require("fs");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

(async () => {
  const dbPath = path.join(__dirname, "..", ".dev-db");
  fs.mkdirSync(dbPath, { recursive: true });
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ dbPath, port: Number(process.env.DEV_DB_PORT) || 27027 }],
  });
  process.env.MONGO_URI = replSet.getUri("bachelormate");
  if (!process.env.JWT_ACCESS_SECRET && !process.env.JWT_SECRET) {
    process.env.JWT_ACCESS_SECRET = "dev-only-secret-change-me-dev-only-secret";
  }
  console.log(`Local MongoDB replica set running (data in ${dbPath})`);
  const stop = async () => {
    await replSet.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  require("../server");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
