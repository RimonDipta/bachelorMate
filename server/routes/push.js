// Register / unregister this device for push notifications.
const express = require("express");
const PushSubscription = require("../models/PushSubscription");
const { validate, z, badRequest } = require("../lib/http");
const push = require("../services/push");

const router = express.Router();

router.get("/push/config", (_req, res) => res.json({ enabled: push.enabled(), publicKey: push.publicKey() }));

const subscription = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Push endpoint must be https"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

router.post("/push/subscriptions", validate({ body: subscription }), async (req, res) => {
  if (!push.enabled()) throw badRequest("Push notifications aren't set up on this server");
  const { endpoint, keys } = req.v.body;
  // An endpoint belongs to one browser; if someone else signs in there, it moves to them.
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { $set: { user: req.user._id, keys, userAgent: String(req.get("user-agent") || "").slice(0, 200) } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ ok: true });
});

router.delete("/push/subscriptions", validate({ body: z.object({ endpoint: z.string().max(1000) }) }), async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.v.body.endpoint, user: req.user._id });
  res.json({ ok: true });
});

module.exports = router;
