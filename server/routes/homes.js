// Home CRUD, settings, ownership, members and invitations.
const express = require("express");
const mongoose = require("mongoose");
const Home = require("../models/Home");
const { HOME_TYPES } = require("../models/Home");
const Membership = require("../models/Membership");
const Invitation = require("../models/Invitation");
const User = require("../models/User");
const { validate, z, objectId, badRequest, forbidden, notFound, conflict, moneyInput } = require("../lib/http");
const { PERMISSIONS, CONFIGURABLE_ROLES, ADMIN_ONLY, ROLE_DEFAULTS, permissionsFor } = require("../lib/permissions");
const { toMinor } = require("../lib/money");
const { isValidTimeZone } = require("../lib/dates");
const { randomToken, sha256 } = require("../lib/security");
const { withTransaction } = require("../lib/transaction");
const { loadHome, requirePerm, requireAdmin } = require("../middleware/home");
const { uniqueHomeCode, ensureHomeConversation, activateMembership } = require("../services/homes");
const { notify } = require("../services/notify");
const { logActivity } = require("../services/activity");
const { balances, emptyBalance } = require("../services/ledger");
const { populateMember } = require("../services/membership");
const realtime = require("../services/realtime");
const env = require("../config/env");
const { sendMail } = require("../lib/mailer");

const router = express.Router();

// ---------- schemas ----------
const mealTypeInput = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,23}$/, "Meal key must be lowercase letters, numbers or _"),
  label: z.string().trim().min(1).max(30),
  weight: z.number().min(0).max(5),
  enabled: z.boolean().default(true),
});
const permList = z.array(z.enum(Object.keys(PERMISSIONS))).max(40);
const settingsInput = z
  .object({
    rules: z.array(z.string().trim().min(1).max(300)).max(30),
    requireApproval: z.boolean(),
    codeJoinEnabled: z.boolean(),
    allowMemberInvites: z.boolean(),
    departureNoticeDays: z.number().int().min(0).max(180),
    paymentDueDay: z.number().int().min(1).max(28),
    mealTypes: z
      .array(mealTypeInput)
      .min(1)
      .max(8)
      .refine((a) => new Set(a.map((t) => t.key)).size === a.length, "Meal type keys must be unique"),
    mealOffCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm"),
    autoApproveMealOff: z.boolean(),
    guestMealPricing: z.enum(["meal_rate", "fixed"]),
    guestMealFixedRate: moneyInput,
    mealPolicy: z.string().max(2000),
    guestPolicy: z.string().max(2000),
    paymentPolicy: z.string().max(2000),
    rolePermissions: z.object({ manager: permList, meal_manager: permList, member: permList }).partial(),
  })
  .partial();
const MEAL_SETTING_KEYS = ["mealTypes", "mealOffCutoff", "autoApproveMealOff", "guestMealPricing", "guestMealFixedRate", "mealPolicy", "guestPolicy"];

const homeInput = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(HOME_TYPES).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").optional(),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone").optional(),
});

const homeView = (home, membership) => ({
  ...home.toObject(),
  myMembership: membership && {
    _id: membership._id,
    roles: membership.roles,
    status: membership.status,
    scheduledLeaveDay: membership.scheduledLeaveDay,
  },
  permissions: membership ? [...permissionsFor(membership, home)] : [],
});

function applySettings(home, input) {
  const s = { ...input };
  if (s.guestMealFixedRate !== undefined) s.guestMealFixedRate = toMinor(s.guestMealFixedRate, { allowZero: true });
  if (s.mealTypes && home.settings?.mealTypes?.length) {
    const next = new Set(s.mealTypes.map((t) => t.key));
    const missing = home.settings.mealTypes.filter((t) => !next.has(t.key));
    if (missing.length) throw badRequest(`Meal types cannot be deleted once used — disable "${missing[0].label}" instead`);
  }
  if (s.rolePermissions) {
    for (const [role, list] of Object.entries(s.rolePermissions)) {
      if (list.some((p) => ADMIN_ONLY.includes(p))) throw badRequest(`Some permissions can only belong to the Admin`);
      home.settings.rolePermissions = { ...(home.settings.rolePermissions || {}), [role]: list };
    }
    home.markModified("settings.rolePermissions");
    delete s.rolePermissions;
  }
  for (const [k, v] of Object.entries(s)) home.settings[k] = v;
}

// ---------- homes ----------
router.get("/", async (req, res) => {
  const memberships = await Membership.find({ user: req.user._id, status: { $in: ["active", "pending"] } }).populate("home");
  const homes = memberships.filter((m) => m.home).map((m) => homeView(m.home, m));
  const counts = await Membership.aggregate([
    { $match: { home: { $in: homes.map((h) => h._id) }, status: "active" } },
    { $group: { _id: "$home", n: { $sum: 1 } } },
  ]);
  const byHome = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ homes: homes.map((h) => ({ ...h, memberCount: byHome.get(String(h._id)) || 0 })) });
});

router.post(
  "/",
  validate({ body: homeInput.extend({ settings: settingsInput.optional() }) }),
  async (req, res) => {
    const { settings, ...data } = req.v.body;
    const home = new Home({ ...data, owner: req.user._id, code: await uniqueHomeCode() });
    if (settings) applySettings(home, settings);
    await withTransaction(async (session) => {
      await home.save({ session });
      await Membership.create(
        [{ home: home._id, user: req.user._id, roles: ["admin"], status: "active", joinedVia: "creator", joinedAt: new Date(), rulesAcceptedAt: new Date() }],
        { session }
      );
    });
    const membership = await Membership.findOne({ home: home._id, user: req.user._id });
    await ensureHomeConversation(home._id);
    realtime.joinHome(req.user._id, home._id);
    req.user.lastActiveHome = home._id;
    await req.user.save();
    await logActivity({ home, actor: req.user._id, action: "home.created", summary: `${req.user.name} created ${home.name}` });
    res.status(201).json({ home: homeView(home, membership) });
  }
);

router.get("/permissions/catalog", (_req, res) => res.json({ permissions: PERMISSIONS, defaults: ROLE_DEFAULTS, adminOnly: ADMIN_ONLY }));

// Everything below is scoped to a home the caller actively belongs to.
const scoped = express.Router({ mergeParams: true });
router.use("/:homeId", loadHome, scoped);

// Archived homes are read-only except for un-archiving / deleting / leaving.
scoped.use((req, _res, next) => {
  if (req.method === "GET" || req.home.status === "active") return next();
  if (["/archive", "/unarchive", "/"].includes(req.path) || req.path.startsWith("/leave")) return next();
  throw forbidden("This home is archived. Restore it to make changes.");
});

scoped.get("/", async (req, res) => {
  const memberCount = await Membership.countDocuments({ home: req.home._id, status: "active" });
  const view = homeView(req.home, req.membership);
  // Join code is only visible to people who can invite.
  if (!req.can("invites.manage") && !req.home.settings.allowMemberInvites) delete view.code;
  res.json({ home: { ...view, memberCount } });
});

scoped.patch("/", requirePerm("home.manage"), validate({ body: homeInput.partial() }), async (req, res) => {
  Object.assign(req.home, req.v.body);
  await req.home.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "home.updated", summary: `${req.user.name} updated home details`, meta: req.v.body });
  res.json({ home: homeView(req.home, req.membership) });
});

scoped.patch("/settings", validate({ body: settingsInput }), async (req, res) => {
  const keys = Object.keys(req.v.body);
  const mealOnly = keys.every((k) => MEAL_SETTING_KEYS.includes(k));
  if (keys.includes("rolePermissions") && !req.membership.roles.includes("admin")) throw forbidden("Only the Admin can change role permissions");
  if (!(req.can("settings.manage") || (mealOnly && req.can("meals.configure")))) throw forbidden();
  applySettings(req.home, req.v.body);
  await req.home.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "settings.updated", summary: `${req.user.name} changed ${keys.join(", ")}`, meta: { keys } });
  res.json({ home: homeView(req.home, req.membership) });
});

scoped.post("/onboarding/complete", requirePerm("home.manage"), async (req, res) => {
  req.home.onboardingCompleted = true;
  await req.home.save();
  res.json({ home: homeView(req.home, req.membership) });
});

scoped.post("/code/regenerate", requirePerm("invites.manage"), async (req, res) => {
  req.home.code = await uniqueHomeCode();
  await req.home.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "invite.code_regenerated", summary: `${req.user.name} regenerated the home code` });
  res.json({ code: req.home.code });
});

scoped.post("/archive", requireAdmin, async (req, res) => {
  req.home.status = "archived";
  await req.home.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "home.archived", summary: `${req.user.name} archived the home` });
  res.json({ home: homeView(req.home, req.membership) });
});

scoped.post("/unarchive", requireAdmin, async (req, res) => {
  req.home.status = "active";
  await req.home.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "home.restored", summary: `${req.user.name} restored the home` });
  res.json({ home: homeView(req.home, req.membership) });
});

// Permanent deletion requires typing the home name. Removes all home data.
scoped.delete("/", requireAdmin, validate({ body: z.object({ confirmName: z.string() }) }), async (req, res) => {
  if (req.v.body.confirmName.trim() !== req.home.name) throw badRequest("Type the exact home name to confirm deletion");
  const homeId = req.home._id;
  const memberUsers = await Membership.find({ home: homeId, status: "active" }).distinct("user");
  const { Conversation, Message, ConversationRead } = require("../models/Chat");
  const conv = await Conversation.findOne({ kind: "home", home: homeId });
  if (conv) {
    await Message.deleteMany({ conversation: conv._id });
    await ConversationRead.deleteMany({ conversation: conv._id });
    await conv.deleteOne();
  }
  const models = ["Membership", "Invitation", "MealEntry", "MealPeriod", "Request", "LedgerEntry", "Expense", "Notification", "Announcement", "GroceryItem", "CalendarEvent", "ActivityLog"];
  for (const name of models) await mongoose.model(name).deleteMany({ home: homeId });
  await req.home.deleteOne();
  memberUsers.forEach((u) => realtime.leaveHome(u, homeId));
  realtime.toUsers(memberUsers, "home:removed", { homeId });
  res.json({ ok: true });
});

scoped.post("/transfer-ownership", requireAdmin, validate({ body: z.object({ membershipId: objectId }) }), async (req, res) => {
  const target = await Membership.findOne({ _id: req.v.body.membershipId, home: req.home._id, status: "active" }).populate("user", "name");
  if (!target) throw notFound("Member not found");
  if (String(target._id) === String(req.membership._id)) throw badRequest("You already own this home");
  await withTransaction(async (session) => {
    target.roles = ["admin"];
    req.membership.roles = ["manager"];
    req.home.owner = target.user._id;
    await target.save({ session });
    await req.membership.save({ session });
    await req.home.save({ session });
  });
  await notify([target.user._id], { type: "role_change", home: req.home._id, title: `You are now the Admin of ${req.home.name}`, link: `/h/${req.home._id}/settings`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "home.ownership_transferred", summary: `${req.user.name} transferred ownership to ${target.user.name}` });
  res.json({ ok: true });
});

// Leaving immediately is only allowed when the home requires no notice;
// otherwise members submit a departure request.
scoped.post("/leave", async (req, res) => {
  if (req.membership.roles.includes("admin")) throw badRequest("Transfer ownership to another member before leaving");
  if (req.home.settings.departureNoticeDays > 0) {
    throw badRequest(`This home requires ${req.home.settings.departureNoticeDays} days notice. Submit a departure request instead.`);
  }
  req.membership.status = "left";
  req.membership.leftAt = new Date();
  await req.membership.save();
  realtime.leaveHome(req.user._id, req.home._id);
  await logActivity({ home: req.home, actor: req.user._id, action: "member.left", summary: `${req.user.name} left the home` });
  res.json({ ok: true });
});

// ---------- members ----------
scoped.get(
  "/members",
  requirePerm("members.view"),
  validate({ query: z.object({ status: z.enum(["active", "pending", "former"]).default("active") }) }),
  async (req, res) => {
    const status = { active: ["active"], pending: ["pending"], former: ["left", "removed", "rejected"] }[req.v.query.status];
    if (req.v.query.status !== "active" && !req.can("members.manage")) throw forbidden();
    const members = await populateMember(Membership.find({ home: req.home._id, status: { $in: status } }).sort({ createdAt: 1 }));
    const showFinance = req.can("finance.view_all");
    const bal = showFinance ? await balances(req.home._id) : {};
    const showPrivate = req.can("members.manage");
    res.json({
      members: members.map((m) => {
        const o = m.toObject({ flattenMaps: true });
        if (!showPrivate && String(m._id) !== String(req.membership._id)) {
          delete o.emergencyContact;
          delete o.note;
          if (o.user) delete o.user.email;
        }
        return {
          ...o,
          online: realtime.isOnline(m.user?._id),
          balance: showFinance ? (bal[String(m._id)] || emptyBalance()).balance : undefined,
        };
      }),
    });
  }
);

const findMember = async (req, statuses = ["active"]) => {
  const m = await Membership.findOne({ _id: req.params.mid, home: req.home._id, status: { $in: statuses } }).populate("user", "name email");
  if (!m) throw notFound("Member not found");
  return m;
};

scoped.patch(
  "/members/:mid",
  validate({
    params: z.object({ mid: objectId }).passthrough(),
    body: z.object({
      room: z.string().trim().max(40).optional(),
      phone: z.string().trim().max(30).optional(),
      emergencyContact: z.string().trim().max(120).optional(),
      note: z.string().trim().max(500).optional(),
      defaultMeals: z.record(z.string(), z.number().min(0).max(10)).optional(),
      mealsEnabled: z.boolean().optional(),
    }),
  }),
  async (req, res) => {
    const target = await findMember(req);
    const self = String(target._id) === String(req.membership._id);
    const body = { ...req.v.body };
    const mealFields = ["defaultMeals", "mealsEnabled"].filter((k) => body[k] !== undefined);
    if (mealFields.length && !req.can("meals.manage")) throw forbidden("Only meal managers can change meal defaults");
    if (body.note !== undefined && !req.can("members.manage")) throw forbidden();
    if (!self && !req.can("members.manage") && Object.keys(body).some((k) => !mealFields.includes(k))) throw forbidden();
    if (body.defaultMeals) {
      const keys = new Set(req.home.settings.mealTypes.map((t) => t.key));
      if (Object.keys(body.defaultMeals).some((k) => !keys.has(k))) throw badRequest("Unknown meal type");
    }
    Object.assign(target, body);
    await target.save();
    await logActivity({ home: req.home, actor: req.user._id, action: "member.updated", summary: `${req.user.name} updated ${target.user.name}'s details`, targetKind: "membership", targetId: target._id });
    res.json({ member: target });
  }
);

scoped.patch(
  "/members/:mid/roles",
  requireAdmin,
  validate({
    params: z.object({ mid: objectId }).passthrough(),
    body: z.object({ roles: z.array(z.enum(["manager", "meal_manager", "member"])).min(1).max(3) }),
  }),
  async (req, res) => {
    const target = await findMember(req);
    if (target.roles.includes("admin")) throw badRequest("Use ownership transfer to change the Admin's role");
    const before = [...target.roles];
    target.roles = [...new Set(req.v.body.roles)];
    await target.save();
    await notify([target.user._id], {
      type: "role_change",
      home: req.home._id,
      title: `Your role in ${req.home.name} changed`,
      body: `New role: ${target.roles.map((r) => r.replace("_", " ")).join(", ")}`,
      link: `/h/${req.home._id}`,
      actor: req.user._id,
    });
    await logActivity({ home: req.home, actor: req.user._id, action: "member.roles_changed", summary: `${req.user.name} changed ${target.user.name}'s role from ${before.join("/")} to ${target.roles.join("/")}`, targetKind: "membership", targetId: target._id, meta: { before, after: target.roles } });
    res.json({ member: target });
  }
);

scoped.post("/members/:mid/approve", requirePerm("members.manage"), validate({ params: z.object({ mid: objectId }).passthrough() }), async (req, res) => {
  const target = await findMember(req, ["pending"]);
  await activateMembership(req.home, target, req.user);
  await logActivity({ home: req.home, actor: req.user._id, action: "member.approved", summary: `${req.user.name} approved ${target.user.name}`, targetKind: "membership", targetId: target._id });
  res.json({ member: target });
});

scoped.post("/members/:mid/reject", requirePerm("members.manage"), validate({ params: z.object({ mid: objectId }).passthrough() }), async (req, res) => {
  const target = await findMember(req, ["pending"]);
  target.status = "rejected";
  await target.save();
  await notify([target.user._id], { type: "request_reviewed", home: req.home._id, title: `Your request to join ${req.home.name} was declined`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "member.rejected", summary: `${req.user.name} declined ${target.user.name}'s join request` });
  res.json({ member: target });
});

scoped.post(
  "/members/:mid/remove",
  requirePerm("members.manage"),
  validate({ params: z.object({ mid: objectId }).passthrough(), body: z.object({ reason: z.string().trim().max(300).optional() }) }),
  async (req, res) => {
    const target = await findMember(req);
    if (target.roles.includes("admin")) throw badRequest("The Admin cannot be removed");
    if (String(target._id) === String(req.membership._id)) throw badRequest("Use leave home instead");
    const privileged = target.roles.some((r) => r === "manager" || r === "meal_manager");
    if (privileged && !req.membership.roles.includes("admin")) throw forbidden("Only the Admin can remove managers");
    const bal = (await balances(req.home._id, [target._id]))[String(target._id)] || emptyBalance();
    target.status = "removed";
    target.leftAt = new Date();
    await target.save();
    realtime.leaveHome(target.user._id, req.home._id);
    realtime.toUser(target.user._id, "home:removed", { homeId: req.home._id });
    await notify([target.user._id], { type: "member_removed", home: req.home._id, title: `You were removed from ${req.home.name}`, body: req.v.body.reason, actor: req.user._id });
    await logActivity({ home: req.home, actor: req.user._id, action: "member.removed", summary: `${req.user.name} removed ${target.user.name}${req.v.body.reason ? `: ${req.v.body.reason}` : ""}`, targetKind: "membership", targetId: target._id, meta: { balance: bal.balance } });
    res.json({ member: target, balance: bal.balance });
  }
);

// ---------- invitations ----------
const canInvite = (req) => req.can("invites.manage") || req.home.settings.allowMemberInvites;

scoped.get("/invitations", async (req, res) => {
  if (!canInvite(req)) throw forbidden();
  const invitations = await Invitation.find({ home: req.home._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("invitee", "name email avatarUrl")
    .populate("createdBy", "name");
  res.json({ invitations, code: req.home.code, codeJoinEnabled: req.home.settings.codeJoinEnabled });
});

scoped.post(
  "/invitations",
  validate({
    body: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("link"),
        label: z.string().trim().max(60).optional(),
        expiresInDays: z.number().int().min(1).max(90).nullable().default(7),
        maxUses: z.number().int().min(1).max(100).nullable().optional(),
      }),
      z.object({
        kind: z.literal("direct"),
        email: z.string().trim().toLowerCase().email().optional(),
        userId: objectId.optional(),
        message: z.string().trim().max(300).optional(),
      }),
    ]),
  }),
  async (req, res) => {
    if (!canInvite(req)) throw forbidden();
    const body = req.v.body;
    const base = { home: req.home._id, createdBy: req.user._id };

    if (body.kind === "link") {
      const token = randomToken(24);
      const inv = await Invitation.create({
        ...base,
        kind: "link",
        tokenHash: sha256(token),
        tokenHint: token.slice(0, 4),
        label: body.label,
        expiresAt: body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86400000) : undefined,
        maxUses: body.maxUses || undefined,
      });
      await logActivity({ home: req.home, actor: req.user._id, action: "invite.created", summary: `${req.user.name} created an invitation link` });
      return res.status(201).json({ invitation: inv, token, url: `${env.CLIENT_URL}/join/${token}` });
    }

    if (!body.email && !body.userId) throw badRequest("Provide an email or a user to invite");
    const invitee = body.userId ? await User.findById(body.userId) : await User.findOne({ email: body.email });
    if (invitee) {
      const existing = await Membership.findOne({ home: req.home._id, user: invitee._id, status: { $in: ["active", "pending"] } });
      if (existing) throw conflict(`${invitee.name} is already ${existing.status === "active" ? "a member" : "waiting for approval"}`);
      if (await Invitation.exists({ home: req.home._id, invitee: invitee._id, kind: "direct", status: "active" })) throw conflict("This person already has a pending invitation");
      const inv = await Invitation.create({ ...base, kind: "direct", invitee: invitee._id, message: body.message, expiresAt: new Date(Date.now() + 14 * 86400000) });
      await notify([invitee._id], {
        type: "home_invitation",
        home: req.home._id,
        title: `${req.user.name} invited you to join ${req.home.name}`,
        body: body.message || "Open BachelorMate to accept or decline.",
        link: `/invitations`,
        actor: req.user._id,
      });
      await logActivity({ home: req.home, actor: req.user._id, action: "invite.sent", summary: `${req.user.name} invited ${invitee.name}` });
      return res.status(201).json({ invitation: inv });
    }
    // Not registered yet: email a single-use invitation link.
    const token = randomToken(24);
    const inv = await Invitation.create({ ...base, kind: "link", tokenHash: sha256(token), tokenHint: token.slice(0, 4), label: `Email: ${body.email}`, maxUses: 1, expiresAt: new Date(Date.now() + 14 * 86400000) });
    await sendMail({
      to: body.email,
      subject: `${req.user.name} invited you to ${req.home.name} on BachelorMate`,
      body: `${req.user.name} invited you to join <b>${req.home.name}</b> — manage meals, expenses and chat together.${body.message ? `<br/><br/>"${body.message.replace(/</g, "&lt;")}"` : ""}`,
      cta: { label: "Accept invitation", url: `${env.CLIENT_URL}/join/${token}` },
    });
    await logActivity({ home: req.home, actor: req.user._id, action: "invite.sent", summary: `${req.user.name} emailed an invitation to ${body.email}` });
    res.status(201).json({ invitation: inv, emailed: true });
  }
);

scoped.delete("/invitations/:id", validate({ params: z.object({ id: objectId }).passthrough() }), async (req, res) => {
  if (!canInvite(req)) throw forbidden();
  const inv = await Invitation.findOne({ _id: req.v.params.id, home: req.home._id });
  if (!inv) throw notFound("Invitation not found");
  inv.status = "revoked";
  inv.revokedAt = new Date();
  await inv.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "invite.revoked", summary: `${req.user.name} revoked an invitation` });
  res.json({ invitation: inv });
});

module.exports = router;
module.exports.scoped = scoped;
