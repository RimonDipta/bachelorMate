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
const { provider: mailProvider } = require("./lib/mailer");
const compression = require("compression");

const homesRouter = require("./routes/homes");

const app = express();
if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Allows popups for optional Google sign-in.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://*.googleapis.com", ...env.CORS_ORIGINS],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

// Optional: serve the built React client from this same service (one-URL
// deploy: same-origin cookies and WebSockets, no CORS needed).
if (env.SERVE_CLIENT) {
  const dist = path.resolve(__dirname, "..", "client", "dist");
  const fs = require("fs");
  if (fs.existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist, { index: false, maxAge: "1y", setHeaders: (res, file) => file.endsWith(".html") && res.setHeader("Cache-Control", "no-cache") }));
    app.get(/^\/(?!api\/|uploads\/|socket\.io\/|health$).*/, (req, res, next) => {
      if (!req.accepts("html")) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(dist, "index.html"));
    });
  } else {
    console.warn(`SERVE_CLIENT is on but ${dist} has no build. Run: npm --prefix client run build`);
  }
}
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin.replace(/\/$/, ""))),
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(cookieParser());
if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev"));

// Ensure the DB is connected (cheap after the first call; serverless-friendly).
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

app.get(["/health", "/api/health"], (_req, res) => res.json({ status: "ok", mail: mailProvider() }));

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
// Stored files (public avatars/photos; private receipts check membership inside).
app.use("/api", require("./routes/files"));
// Public seat listings can be browsed without an account.
app.use("/api/public", require("./routes/publicListings"));

// Everything below requires authentication.
app.use("/api", protect);
app.use("/api/users", require("./routes/users"));
app.use("/api", require("./routes/join"));
app.use("/api", require("./routes/chat"));
app.use("/api", require("./routes/community"));

// Home-scoped modules hang off the loadHome-protected router.
homesRouter.scoped.use(require("./routes/meals"));
homesRouter.scoped.use(require("./routes/requests"));
homesRouter.scoped.use(require("./routes/finance"));
homesRouter.scoped.use(require("./routes/recurring"));
homesRouter.scoped.use(require("./routes/listings"));
homesRouter.scoped.use(require("./routes/homeExtras"));
app.use("/api/homes", homesRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
