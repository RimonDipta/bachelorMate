// Starts the real server (serving the built client) on a throwaway in-memory
// database for the browser tests. Build the client first: npm --prefix client run build
const path = require("path");
const serverDir = path.join(__dirname, "..", "server");
const { MongoMemoryReplSet } = require(path.join(serverDir, "node_modules", "mongodb-memory-server"));

(async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  Object.assign(process.env, {
    NODE_ENV: "development",
    PORT: process.env.E2E_PORT || "5055",
    MONGO_URI: replSet.getUri("bachelormate-e2e"),
    JWT_ACCESS_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only",
    SERVE_CLIENT: "true",
    CLIENT_URL: `http://localhost:${process.env.E2E_PORT || 5055}`,
    CORS_ORIGINS: `http://localhost:${process.env.E2E_PORT || 5055}`,
    REQUIRE_EMAIL_VERIFICATION: "false",
  });
  const stop = async () => {
    await replSet.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  require(path.join(serverDir, "server.js"));
})();
