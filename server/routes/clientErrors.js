// Crash reports from the browser app (no account needed: errors can happen
// before sign-in). Strictly limited and size-capped so it can't be abused.
const express = require("express");
const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const { validate, z } = require("../lib/http");
const { reportClientError } = require("../lib/monitoring");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 1000 : 10, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many reports" } });

const report = z.object({
  name: z.string().max(100).optional(),
  message: z.string().min(1).max(500),
  stack: z.string().max(4000).optional(),
  componentStack: z.string().max(2000).optional(),
  url: z.string().max(500).optional(),
  release: z.string().max(40).optional(),
  kind: z.enum(["boundary", "error", "rejection"]).default("error"),
});

router.post("/client-errors", limiter, validate({ body: report }), (req, res) => {
  // Drop query strings and fragments: they can carry tokens.
  const url = req.v.body.url?.split(/[?#]/)[0];
  const ref = reportClientError({ ...req.v.body, url }, { userAgent: String(req.get("user-agent") || "").slice(0, 200) });
  res.status(202).json({ ref });
});

module.exports = router;
