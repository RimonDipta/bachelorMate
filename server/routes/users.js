const express = require("express");
const env = require("../config/env");
const User = require("../models/User");
const { ACCENTS } = require("../models/User");
const { NOTIFICATION_TYPES } = require("../models/Misc");
const { Friendship, pairKey } = require("../models/Chat");
const { validate, z, badRequest, notFound, objectId } = require("../lib/http");
const { escapeRegex } = require("../lib/security");
const { makeUploader, removeUpload } = require("../middleware/upload");
const { deleteByUrl } = require("../services/storage");
const realtime = require("../services/realtime");
const { exportUserData, deleteAccount, deletionBlockers } = require("../services/account");

const router = express.Router();
const avatarUpload = makeUploader("avatar");

// Deletes the previous avatar whether it lives in GridFS or on legacy disk storage.
const dropAvatar = async (url) => {
  if (!url) return;
  if (url.startsWith("/api/files/")) await deleteByUrl(url);
  else if (url.startsWith("/uploads/")) await removeUpload(url.replace("/uploads/", ""));
};

router.patch(
  "/me",
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(30).optional(),
      bio: z.string().trim().max(280).optional(),
      discoverable: z.boolean().optional(),
    }),
  }),
  async (req, res) => {
    Object.assign(req.user, req.v.body);
    await req.user.save();
    res.json({ user: req.user });
  }
);

router.post("/me/avatar", ...avatarUpload("avatar"), async (req, res) => {
  if (!req.file) throw badRequest("Choose an image to upload");
  const previous = req.user.avatarUrl;
  req.user.avatarUrl = req.file.url;
  await req.user.save();
  await dropAvatar(previous);
  res.json({ user: req.user });
});

router.delete("/me/avatar", async (req, res) => {
  await dropAvatar(req.user.avatarUrl);
  req.user.avatarUrl = undefined;
  await req.user.save();
  res.json({ user: req.user });
});

// ---------- your data ----------
router.get("/me/export", async (req, res) => {
  const data = await exportUserData(req.user);
  res.setHeader("Content-Disposition", `attachment; filename="bachelormate-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.type("application/json").send(JSON.stringify(data, null, 2));
});

router.get("/me/deletion-check", async (req, res) => {
  res.json({ blockers: await deletionBlockers(req.user) });
});

router.delete(
  "/me",
  validate({ body: z.object({ password: z.string().max(200).optional(), confirm: z.literal("DELETE") }) }),
  async (req, res) => {
    const user = await User.findById(req.user._id).select("+passwordHash");
    // Password accounts confirm with their password; Google accounts with the typed word.
    if (user.passwordHash && !(await user.validatePassword(req.v.body.password || ""))) throw badRequest("That password isn't right");
    await deleteAccount(user);
    // Sessions are already revoked; this just tidies the browser.
    res.clearCookie("bm_rt", { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, path: "/api/auth" });
    res.json({ ok: true });
  }
);

router.patch(
  "/me/preferences",
  validate({
    body: z.object({
      appearance: z
        .object({
          mode: z.enum(["light", "dark", "system"]).optional(),
          accent: z.enum(ACCENTS).optional(),
          preset: z.enum(["default", "slate", "warm", "contrast"]).optional(),
          density: z.enum(["comfortable", "compact"]).optional(),
          language: z.enum(["en", "bn"]).optional(),
        })
        .optional(),
      notificationPrefs: z
        .object({
          email: z.boolean().optional(),
          muted: z.array(z.enum(NOTIFICATION_TYPES)).max(50).optional(),
        })
        .optional(),
      lastActiveHome: objectId.nullable().optional(),
    }),
  }),
  async (req, res) => {
    const { appearance, notificationPrefs, lastActiveHome } = req.v.body;
    if (appearance) for (const [k, v] of Object.entries(appearance)) req.user.appearance[k] = v;
    if (notificationPrefs) for (const [k, v] of Object.entries(notificationPrefs)) req.user.notificationPrefs[k] = v;
    if (lastActiveHome !== undefined) req.user.lastActiveHome = lastActiveHome;
    await req.user.save();
    res.json({ user: req.user });
  }
);

// Search people to add as friends. Only discoverable users, minimal fields.
router.get(
  "/search",
  validate({ query: z.object({ q: z.string().trim().min(2).max(80) }) }),
  async (req, res) => {
    const q = escapeRegex(req.v.query.q);
    const users = await User.find({
      _id: { $ne: req.user._id },
      discoverable: true,
      $or: [{ name: { $regex: q, $options: "i" } }, { email: { $regex: `^${q}$`, $options: "i" } }],
    })
      .select("name avatarUrl bio")
      .limit(20);
    const keys = users.map((u) => pairKey(u._id, req.user._id));
    const friendships = await Friendship.find({ pairKey: { $in: keys } });
    const byKey = new Map(friendships.map((f) => [f.pairKey, f]));
    res.json({
      users: users.map((u) => {
        const f = byKey.get(pairKey(u._id, req.user._id));
        let relation = "none";
        if (f?.status === "accepted") relation = "friends";
        else if (f) relation = String(f.requester) === String(req.user._id) ? "requested" : "incoming";
        return { ...u.toPublic(), relation, friendshipId: f?._id, online: realtime.isOnline(u._id) };
      }),
    });
  }
);

router.get("/:userId", validate({ params: z.object({ userId: objectId }) }), async (req, res) => {
  const user = await User.findById(req.v.params.userId);
  if (!user) throw notFound("User not found");
  res.json({ user: { ...user.toPublic(), online: realtime.isOnline(user._id), lastSeenAt: user.lastSeenAt } });
});

module.exports = router;
