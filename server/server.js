// HTTP + Socket.IO server entry point.
const http = require("http");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const app = require("./app");
const { initSockets } = require("./sockets");

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initSockets(server);
  server.listen(env.PORT, () => console.log(`BachelorMate API listening on http://localhost:${env.PORT}`));

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
