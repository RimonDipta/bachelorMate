// Joining homes: invitation links, home codes and in-app invitations.
const express = require("express");
const rateLimit = require("express-rate-limit");
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const Invitation = require("../models/Invitation");
const { validate, z, objectId, badRequest, notFound } = require("../lib/http");
const { sha256 } = require("../lib/security");
const { joinHome } = require("../services/homes");
const { requireVerified } = require("../middleware/auth");
const { notify } = require("../services/notify");
const env = require("../config/env");

const router = express.Router();

// Codes are short, so throttle guessing.
const joinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 30, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many attempts. Try again later." } });

const target = z
  .object({ token: z.string().min(10).max(100).optional(), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,10}$/, "Invalid code").optional() })
  .refine((v) => v.token || v.code, "Provide an invitation token or home code");

async function resolveTarget({ token, code }) {
  if (token) {
    const invitation = await Invitation.findOne({ tokenHash: sha256(token), kind: "link" });
    if (!invitation) throw notFound("This invitation link is invalid");
    if (invitation.status === "revoked") throw badRequest("This invitation has been revoked");
    if (!invitation.isUsable()) throw badRequest("This invitation has expired");
    const home = await Home.findById(invitation.home);
    if (!home || home.status !== "active") throw notFound("This home is no longer available");
    return { home, invitation, via: "link" };
  }
  const home = await Home.findOne({ code, status: "active" });
  if (!home || !home.settings.codeJoinEnabled) throw notFound("No home matches this code");
  return { home, via: "code" };
}

const preview = async (home, userId) => {
  const [memberCount, mine] = await Promise.all([
    Membership.countDocuments({ home: home._id, status: "active" }),
    Membership.findOne({ home: home._id, user: userId }).select("status"),
  ]);
  return {
    _id: home._id,
    name: home.name,
    address: home.address,
    description: home.description,
    type: home.type,
    currency: home.currency,
    memberCount,
    rules: home.settings.rules,
    mealPolicy: home.settings.mealPolicy,
    guestPolicy: home.settings.guestPolicy,
    paymentPolicy: home.settings.paymentPolicy,
    departureNoticeDays: home.settings.departureNoticeDays,
    myStatus: mine?.status || null,
  };
};

router.get("/join/preview", joinLimiter, validate({ query: target }), async (req, res) => {
  const { home, via } = await resolveTarget(req.v.query);
  res.json({ home: await preview(home, req.user._id), via, requiresApproval: home.settings.requireApproval });
});

const profileInput = {
  rulesAccepted: z.literal(true, { message: "You must accept the house rules" }),
  room: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(30).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
};

router.post(
  "/join",
  joinLimiter,
  requireVerified,
  validate({ body: z.object({ token: z.string().min(10).max(100).optional(), code: z.string().trim().toUpperCase().optional(), ...profileInput }) }),
  async (req, res) => {
    const { token, code, rulesAccepted: _r, ...profile } = req.v.body;
    if (!token && !code) throw badRequest("Provide an invitation token or home code");
    const { home, invitation, via } = await resolveTarget({ token, code });
    const membership = await joinHome({ home, user: req.user, via, invitedBy: invitation?.createdBy, profile });
    if (invitation) {
      // Atomic increment guards the usage limit against concurrent joins.
      const updated = await Invitation.findOneAndUpdate(
        { _id: invitation._id, ...(invitation.maxUses ? { uses: { $lt: invitation.maxUses } } : {}) },
        { $inc: { uses: 1 } },
        { new: true }
      );
      if (updated?.maxUses && updated.uses >= updated.maxUses) {
        updated.status = "accepted";
        await updated.save();
      }
    }
    res.status(201).json({ membership, homeId: home._id, status: membership.status });
  }
);

// In-app (direct) invitations addressed to the current user.
router.get("/invitations/mine", async (req, res) => {
  const invitations = await Invitation.find({ invitee: req.user._id, kind: "direct", status: "active" })
    .populate("home", "name address type description settings.rules settings.departureNoticeDays status")
    .populate("createdBy", "name avatarUrl")
    .sort({ createdAt: -1 });
  res.json({ invitations: invitations.filter((i) => i.isUsable() && i.home?.status === "active") });
});

const findMine = async (req) => {
  const inv = await Invitation.findOne({ _id: req.v.params.id, invitee: req.user._id, kind: "direct" });
  if (!inv) throw notFound("Invitation not found");
  if (!inv.isUsable()) throw badRequest("This invitation is no longer valid");
  return inv;
};

router.post(
  "/invitations/:id/accept",
  requireVerified,
  validate({ params: z.object({ id: objectId }), body: z.object(profileInput) }),
  async (req, res) => {
    const inv = await findMine(req);
    const home = await Home.findById(inv.home);
    if (!home) throw notFound("Home not found");
    const { rulesAccepted: _r, ...profile } = req.v.body;
    // A direct invitation from someone allowed to invite counts as approval.
    const membership = await joinHome({ home, user: req.user, via: "direct", invitedBy: inv.createdBy, profile, forceActive: true });
    inv.status = "accepted";
    inv.uses = 1;
    await inv.save();
    await notify([inv.createdBy], { type: "invitation_accepted", home: home._id, title: `${req.user.name} accepted your invitation`, link: `/h/${home._id}/members`, actor: req.user._id });
    res.json({ membership, homeId: home._id, status: membership.status });
  }
);

router.post("/invitations/:id/decline", validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const inv = await findMine(req);
  inv.status = "declined";
  await inv.save();
  res.json({ ok: true });
});

module.exports = router;
