// Recurring costs: templates that post an expense every month/week, divided
// equally, between chosen members, or with a custom amount per member.
const express = require("express");
const Membership = require("../models/Membership");
const { RecurringExpense, EXPENSE_CATEGORIES, MEAL_CATEGORIES } = require("../models/Finance");
const { validate, z, objectId, day, badRequest, notFound, forbidden, moneyInput } = require("../lib/http");
const { toMinor } = require("../lib/money");
const { isValidDay, todayIn, addDays } = require("../lib/dates");
const { requirePerm } = require("../middleware/home");
const { balances, emptyBalance } = require("../services/ledger");
const { nextOccurrence, resolveShares, syncHome } = require("../services/recurring");
const { logActivity } = require("../services/activity");

const router = express.Router({ mergeParams: true });
const RECURRING_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => !MEAL_CATEGORIES.includes(c));
const canSee = (req) => req.can("expenses.view") || req.can("expenses.manage") || req.can("finance.view_all");
const fmt = (minor, cur) => `${(minor / 100).toFixed(2)} ${cur}`;

const input = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(RECURRING_CATEGORIES),
  amount: moneyInput,
  frequency: z.enum(["monthly", "weekly"]).default("monthly"),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  weekday: z.number().int().min(0).max(6).default(0),
  startDay: day,
  endDay: day.nullable().optional(),
  paidBy: objectId.nullable().optional(),
  allocation: z.object({
    mode: z.enum(["equal", "custom", "none"]),
    allMembers: z.boolean().default(true),
    memberships: z.array(objectId).max(100).default([]),
    shares: z.array(z.object({ membershipId: objectId, amount: moneyInput })).max(100).default([]),
  }),
  notes: z.string().trim().max(500).optional(),
});

async function buildTemplate(req, b) {
  if (!isValidDay(b.startDay) || (b.endDay && (!isValidDay(b.endDay) || b.endDay < b.startDay))) throw badRequest("Invalid dates");
  const amount = toMinor(b.amount);
  const ids = new Set((await Membership.find({ home: req.home._id, status: "active" }).select("_id")).map((m) => String(m._id)));
  const a = { mode: b.allocation.mode, allMembers: b.allocation.allMembers, memberships: [], shares: [] };

  if (a.mode === "equal" && !a.allMembers) {
    const chosen = [...new Set(b.allocation.memberships)];
    if (!chosen.length) throw badRequest("Choose who shares this cost");
    if (chosen.some((id) => !ids.has(id))) throw badRequest("Everyone in the split must be an active member");
    a.memberships = chosen;
  }
  if (a.mode === "custom") {
    const seen = new Set();
    for (const s of b.allocation.shares) {
      if (!ids.has(s.membershipId)) throw badRequest("Everyone in the split must be an active member");
      if (seen.has(s.membershipId)) throw badRequest("Each member can appear only once");
      seen.add(s.membershipId);
      a.shares.push({ membership: s.membershipId, amount: toMinor(s.amount, { allowZero: true }) });
    }
    const total = a.shares.reduce((x, s) => x + s.amount, 0);
    if (total !== amount) throw badRequest(`Custom amounts add up to ${fmt(total, req.home.currency)}, but the cost is ${fmt(amount, req.home.currency)}`);
  }
  if (b.paidBy && !ids.has(b.paidBy)) throw badRequest("Payer must be an active member");
  return {
    title: b.title,
    category: b.category,
    amount,
    frequency: b.frequency,
    dayOfMonth: b.dayOfMonth,
    weekday: b.weekday,
    startDay: b.startDay,
    endDay: b.endDay || undefined,
    paidBy: b.paidBy || null,
    allocation: a,
    notes: b.notes,
  };
}

async function view(req, templates) {
  const members = await Membership.find({ home: req.home._id, status: "active" }).populate("user", "name avatarUrl").sort({ createdAt: 1 });
  const activeIds = members.map((m) => m._id);
  const showBalances = req.can("finance.view_all");
  const bal = showBalances ? await balances(req.home._id) : {};
  const out = [];
  for (const t of templates) {
    const { amount, shares } = await resolveShares(t, activeIds);
    out.push({ ...t.toObject(), nextDay: nextOccurrence(t), perMember: shares.map((s) => ({ membership: s.membership, amount: s.amount })), effectiveAmount: amount });
  }
  return {
    templates: out,
    members: members.map((m) => ({
      _id: m._id,
      user: m.user,
      roles: m.roles,
      balance: showBalances ? (bal[String(m._id)] || emptyBalance()).balance : undefined,
    })),
    today: todayIn(req.home.timezone),
  };
}

router.get("/recurring", async (req, res) => {
  if (!canSee(req)) throw forbidden();
  const templates = await RecurringExpense.find({ home: req.home._id }).sort({ active: -1, createdAt: 1 }).populate("createdBy", "name");
  res.json(await view(req, templates));
});

router.post("/recurring", requirePerm("expenses.manage"), validate({ body: input }), async (req, res) => {
  const t = await RecurringExpense.create({ ...(await buildTemplate(req, req.v.body)), home: req.home._id, createdBy: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "recurring.created", summary: `${req.user.name} added recurring cost "${t.title}" (${fmt(t.amount, req.home.currency)} ${t.frequency})`, targetKind: "recurring", targetId: t._id });
  const posted = await syncHome(req.home, { force: true, actorId: req.user._id });
  res.status(201).json({ template: t, posted });
});

const findT = async (req) => {
  const t = await RecurringExpense.findOne({ _id: req.params.rid, home: req.home._id });
  if (!t) throw notFound("Recurring cost not found");
  return t;
};
const ridParam = z.object({ rid: objectId }).passthrough();

// Edits apply to future occurrences; already-posted expenses are untouched
// (edit or void those individually so the audit trail stays honest).
router.patch("/recurring/:rid", requirePerm("expenses.manage"), validate({ params: ridParam, body: input }), async (req, res) => {
  const t = await findT(req);
  Object.assign(t, await buildTemplate(req, req.v.body));
  await t.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "recurring.updated", summary: `${req.user.name} updated recurring cost "${t.title}"`, targetKind: "recurring", targetId: t._id });
  const posted = await syncHome(req.home, { force: true, actorId: req.user._id });
  res.json({ template: t, posted });
});

router.post("/recurring/:rid/active", requirePerm("expenses.manage"), validate({ params: ridParam, body: z.object({ active: z.boolean() }) }), async (req, res) => {
  const t = await findT(req);
  t.active = req.v.body.active;
  // Resuming never back-charges the paused months.
  if (t.active) {
    const yesterday = addDays(todayIn(req.home.timezone), -1);
    if (!t.lastPostedDay || t.lastPostedDay < yesterday) t.lastPostedDay = yesterday;
  }
  await t.save();
  await logActivity({ home: req.home, actor: req.user._id, action: "recurring.toggled", summary: `${req.user.name} ${t.active ? "resumed" : "paused"} recurring cost "${t.title}"` });
  const posted = t.active ? await syncHome(req.home, { force: true, actorId: req.user._id }) : 0;
  res.json({ template: t, posted });
});

router.delete("/recurring/:rid", requirePerm("expenses.manage"), validate({ params: ridParam }), async (req, res) => {
  const t = await findT(req);
  await t.deleteOne(); // expenses it already posted stay in the books
  await logActivity({ home: req.home, actor: req.user._id, action: "recurring.deleted", summary: `${req.user.name} deleted recurring cost "${t.title}"` });
  res.json({ ok: true });
});

router.post("/recurring/sync", requirePerm("expenses.manage"), async (req, res) => {
  res.json({ posted: await syncHome(req.home, { force: true, actorId: req.user._id }) });
});

module.exports = router;
