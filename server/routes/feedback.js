// "Send feedback" from inside the app. Saved for the operator to read, and
// emailed to FEEDBACK_EMAIL when that is set.
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const Feedback = require("../models/Feedback");
const { validate, z } = require("../lib/http");
const { sendMail, esc } = require("../lib/mailer");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: env.isTest ? 1000 : 20, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many attempts. Try again later." } });

const input = z.object({
  kind: z.enum(["problem", "idea", "praise", "other"]).default("other"),
  message: z.string().trim().min(3).max(2000),
  page: z.string().max(300).optional(),
  homeId: z.string().optional(),
  language: z.string().max(10).optional(),
  release: z.string().max(40).optional(),
  screen: z.string().max(20).optional(),
});

router.post("/feedback", limiter, validate({ body: input }), async (req, res) => {
  const b = req.v.body;
  const feedback = await Feedback.create({
    user: req.user._id,
    kind: b.kind,
    message: b.message,
    // Paths only: query strings can carry tokens.
    page: b.page?.split(/[?#]/)[0],
    home: b.homeId && mongoose.isValidObjectId(b.homeId) ? b.homeId : undefined,
    language: b.language,
    release: b.release,
    screen: b.screen,
    userAgent: String(req.get("user-agent") || "").slice(0, 300),
  });
  console.log(`[feedback] ${b.kind} from ${req.user.email} on ${feedback.page || "?"}: ${b.message.slice(0, 200)}`);
  if (env.FEEDBACK_EMAIL) {
    sendMail({
      to: env.FEEDBACK_EMAIL,
      subject: `BachelorMate feedback (${b.kind}) from ${req.user.name}`,
      body: [
        `<b>${esc(req.user.name)}</b> &lt;${esc(req.user.email)}&gt; sent ${esc(b.kind)} feedback:`,
        `<br/><br/>${esc(b.message).split("\n").join("<br/>")}`,
        `<br/><br/>Page: ${esc(feedback.page || "—")} · Language: ${esc(b.language || "—")} · Screen: ${esc(b.screen || "—")} · Version: ${esc(b.release || "—")}`,
      ].join(""),
    });
  }
  res.status(201).json({ ok: true, id: feedback._id });
});

module.exports = router;
