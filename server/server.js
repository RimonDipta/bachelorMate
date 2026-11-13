// HTTP + Socket.IO server entry point.
const http = require("http");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const app = require("./app");
const { initSockets } = require("./sockets");

async function start() {
  await connectDB();

  // SEED_DEMO=true loads the demo home once (only if the demo admin doesn't exist yet).
  if (["1", "true", "yes"].includes(String(process.env.SEED_DEMO).toLowerCase())) {
    const User = require("./models/User");
    const { seedDemo, DOMAIN } = require("./scripts/seed-demo");
    if (!(await User.exists({ email: `admin@${DOMAIN}` }))) {
      await seedDemo();
      console.log(`Demo data seeded. Sign in as admin@${DOMAIN}`);
    }
  }

  // Post due recurring costs now and then hourly, even for homes nobody opens.
  const { syncAllHomes } = require("./services/recurring");
  const sweep = () => syncAllHomes().catch((err) => console.error("Recurring sweep failed:", err.message));
  sweep();
  setInterval(sweep, 60 * 60 * 1000).unref();

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
