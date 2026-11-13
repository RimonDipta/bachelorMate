// Centralised, validated environment configuration.
require("dotenv").config({ quiet: true });

const bool = (v, def = false) =>
  v === undefined || v === "" ? def : ["1", "true", "yes"].includes(String(v).toLowerCase());

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

const env = {
  NODE_ENV,
  isProd,
  isTest,
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: process.env.MONGO_URI,
  // JWT_SECRET kept as a fallback for backwards compatibility with old deployments.
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "15m",
  REFRESH_TOKEN_DAYS: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  CLIENT_URL: (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, ""),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
  COOKIE_SECURE: bool(process.env.COOKIE_SECURE, isProd),
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || (isProd ? "none" : "lax"),
  TRUST_PROXY: bool(process.env.TRUST_PROXY, isProd),
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM || "BachelorMate <no-reply@bachelormate.local>",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  UPLOAD_DIR: process.env.UPLOAD_DIR || require("path").join(__dirname, "..", "uploads"),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB) || 5,
};

if (!env.JWT_ACCESS_SECRET) {
  if (isTest) env.JWT_ACCESS_SECRET = "test-secret";
  else throw new Error("JWT_ACCESS_SECRET (or JWT_SECRET) must be set");
}
if (isProd && env.JWT_ACCESS_SECRET.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 characters in production");
}

module.exports = env;
