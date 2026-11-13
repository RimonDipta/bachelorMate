// Express application (no listen) – shared by server.js, serverless and tests.
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const { protect } = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/errors");

const homesRouter = require("./routes/homes");

const app = express();
if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin.replace(/\/$/, ""))),
    credentials: true,
  })
);
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(cookieParser());
if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));

// Ensure the DB is connected (cheap after the first call; serverless-friendly).
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

app.get(["/health", "/api/health"], (_req, res) => res.json({ status: "ok" }));

// Avatars are public; receipts are served through an authorised route.
app.use(
  "/uploads/avatars",
  express.static(path.join(env.UPLOAD_DIR, "avatars"), {
    maxAge: "7d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 10000 : 300, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many requests, slow down." } }));
app.use("/api/auth", require("./routes/auth"));

// Everything below requires authentication.
app.use("/api", protect);
app.use("/api/users", require("./routes/users"));
app.use("/api", require("./routes/join"));
app.use("/api", require("./routes/chat"));

// Home-scoped modules hang off the loadHome-protected router.
homesRouter.scoped.use(require("./routes/meals"));
homesRouter.scoped.use(require("./routes/requests"));
homesRouter.scoped.use(require("./routes/finance"));
homesRouter.scoped.use(require("./routes/homeExtras"));
app.use("/api/homes", homesRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
