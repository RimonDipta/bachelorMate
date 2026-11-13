// Dashboard, announcements, grocery list, calendar, reports and activity log.
const express = require("express");
const Membership = require("../models/Membership");
const Request = require("../models/Request");
const { MealEntry, MealPeriod } = require("../models/Meal");
const { LedgerEntry, Expense, MEAL_CATEGORIES } = require("../models/Finance");
const { Announcement, GroceryItem, CalendarEvent, ActivityLog } = require("../models/Misc");
const { validate, z, objectId, day, badRequest, notFound, forbidden, moneyInput } = require("../lib/http");
const { toMinor } = require("../lib/money");
const { todayIn, addDays, monthRange, isValidDay, diffDays } = require("../lib/dates");
const { sendCsv } = require("../lib/csv");
const { withTransaction } = require("../lib/transaction");
const { requirePerm } = require("../middleware/home");
const { balances, emptyBalance, postExpense } = require("../services/ledger");
const { computePeriod } = require("../services/meals");
const { notifyPermitted } = require("../services/notify");
const { logActivity } = require("../services/activity");
const realtime = require("../services/realtime");

const router = express.Router({ mergeParams: true });
const monthQ = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
const fmt = (minor, cur) => `${(minor / 100).toFixed(2)} ${cur}`;

// ---------- dashboard ----------
router.get("/dashboard", async (req, res) => {
  const home = req.home;
  const today = todayIn(home.timezone);
  const month = today.slice(0, 7);
  const { from, to } = monthRange(month);
  const reviewTypes = [
    ...(req.can("meals.review") ? ["meal_off", "guest_meal"] : []),
    ...(req.can("requests.review") ? ["absence", "departure"] : []),
  ];

  const [memberCount, pendingJoins, todayEntries, monthExp, bal, pendingReview, myPending, openPeriod, announcements, activity, pendingPayments] = await Promise.all([
    Membership.countDocuments({ home: home._id, status: "active" }),
    req.can("members.manage") ? Membership.countDocuments({ home: home._id, status: "pending" }) : 0,
    MealEntry.find({ home: home._id, day: today }),
    Expense.aggregate([{ $match: { home: home._id, status: "active", day: { $gte: from, $lte: to } } }, { $group: { _id: { $in: ["$category", MEAL_CATEGORIES] }, total: { $sum: "$amount" } } }]),
    balances(home._id),
    reviewTypes.length ? Request.countDocuments({ home: home._id, status: "pending", type: { $in: reviewTypes } }) : 0,
    Request.countDocuments({ home: home._id, membership: req.membership._id, status: "pending" }),
    MealPeriod.findOne({ home: home._id, status: "open", startDay: { $lte: today }, endDay: { $gte: today } }),
    Announcement.find({ home: home._id }).sort({ pinned: -1, createdAt: -1 }).limit(3).populate("author", "name avatarUrl"),
    req.can("activity.view") ? ActivityLog.find({ home: home._id }).sort({ createdAt: -1 }).limit(8).populate("actor", "name avatarUrl") : [],
    req.can("finance.record") ? LedgerEntry.countDocuments({ home: home._id, status: "pending" }) : 0,
  ]);

  const mealTotals = {};
  const guestTotals = {};
  let mine = null;
  for (const e of todayEntries) {
    for (const [k, v] of e.counts) mealTotals[k] = (mealTotals[k] || 0) + v;
    for (const [k, v] of e.guests) guestTotals[k] = (guestTotals[k] || 0) + v;
    if (String(e.membership) === String(req.membership._id)) mine = { counts: Object.fromEntries(e.counts), guests: Object.fromEntries(e.guests) };
  }

  let dues = 0, advances = 0;
  Object.values(bal).forEach((b) => (b.balance < 0 ? (dues += -b.balance) : (advances += b.balance)));
  const myBalance = bal[String(req.membership._id)] || emptyBalance();

  const period = openPeriod || { name: "This month", startDay: from, endDay: to };
  const live = await computePeriod(home, period);
  const myLive = live.members.find((m) => m.membership === String(req.membership._id));

  const upcoming = await buildCalendar(req, today, addDays(today, 14));

  res.json({
    today,
    memberCount,
    pendingJoins,
    pendingReview,
    myPending,
    pendingPayments,
    meals: { mealTypes: home.settings.mealTypes, totals: mealTotals, guests: guestTotals, mine },
    month: {
      key: month,
      total: monthExp.reduce((a, r) => a + r.total, 0),
      meal: monthExp.find((r) => r._id === true)?.total || 0,
      other: monthExp.find((r) => r._id === false)?.total || 0,
    },
    finance: {
      myBalance: myBalance.balance,
      myPayable: Math.max(0, -myBalance.balance),
      outstandingDues: req.can("finance.view_all") ? dues : undefined,
      advances: req.can("finance.view_all") ? advances : undefined,
    },
    mealPeriod: { name: period.name, _id: openPeriod?._id, startDay: period.startDay, endDay: period.endDay, rate: live.rate, totalExpense: live.totalExpense, chargeableMeals: live.chargeableMeals, myMeals: myLive ? myLive.meals + myLive.guestMeals : 0, myEstimatedCharge: myLive?.charge || 0 },
    announcements,
    activity,
    upcoming: upcoming.slice(0, 6),
  });
});

// ---------- announcements ----------
router.get("/announcements", async (req, res) => {
  const items = await Announcement.find({ home: req.home._id }).sort({ pinned: -1, createdAt: -1 }).limit(100).populate("author", "name avatarUrl").populate("acknowledgements.user", "name");
  res.json({ announcements: items });
});

const annInput = z.object({ title: z.string().trim().min(2).max(140), body: z.string().trim().min(1).max(5000), important: z.boolean().default(false), pinned: z.boolean().default(false), eventDay: day.optional().or(z.literal("")) });

router.post("/announcements", requirePerm("announcements.manage"), validate({ body: annInput }), async (req, res) => {
  const b = req.v.body;
  const a = await Announcement.create({ ...b, eventDay: b.eventDay || undefined, home: req.home._id, author: req.user._id });
  await notifyPermitted(req.home, "members.view", { type: "announcement", title: `${b.important ? "Important: " : ""}${a.title}`, body: a.body.slice(0, 200), link: `/h/${req.home._id}/announcements`, actor: req.user._id, email: b.important });
  await logActivity({ home: req.home, actor: req.user._id, action: "announcement.published", summary: `${req.user.name} published "${a.title}"` });
  realtime.toHome(req.home._id, "announcement:new", { _id: a._id });
  res.status(201).json({ announcement: a });
});

const aidParam = z.object({ aid: objectId }).passthrough();
router.patch("/announcements/:aid", requirePerm("announcements.manage"), validate({ params: aidParam, body: annInput.partial() }), async (req, res) => {
  const a = await Announcement.findOne({ _id: req.params.aid, home: req.home._id });
  if (!a) throw notFound("Announcement not found");
  Object.assign(a, { ...req.v.body, eventDay: req.v.body.eventDay === "" ? undefined : req.v.body.eventDay ?? a.eventDay });
  await a.save();
  res.json({ announcement: a });
});

router.delete("/announcements/:aid", requirePerm("announcements.manage"), validate({ params: aidParam }), async (req, res) => {
  const a = await Announcement.findOneAndDelete({ _id: req.params.aid, home: req.home._id });
  if (!a) throw notFound("Announcement not found");
  await logActivity({ home: req.home, actor: req.user._id, action: "announcement.deleted", summary: `${req.user.name} deleted "${a.title}"` });
  res.json({ ok: true });
});

router.post("/announcements/:aid/acknowledge", validate({ params: aidParam }), async (req, res) => {
  const a = await Announcement.findOne({ _id: req.params.aid, home: req.home._id });
  if (!a) throw notFound("Announcement not found");
  if (!a.acknowledgements.some((x) => String(x.user) === String(req.user._id))) {
    a.acknowledgements.push({ user: req.user._id, at: new Date() });
    await a.save();
  }
  res.json({ announcement: a });
});

// ---------- grocery ----------
router.get("/grocery", async (req, res) => {
  const items = await GroceryItem.find({ home: req.home._id, $or: [{ purchased: false }, { purchasedAt: { $gte: new Date(Date.now() - 30 * 86400000) } }] })
    .sort({ purchased: 1, createdAt: -1 })
    .populate({ path: "assignedTo", select: "user", populate: { path: "user", select: "name avatarUrl" } })
    .populate("createdBy", "name");
  res.json({ items });
});

const groceryInput = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().min(0).max(100000).default(1),
  unit: z.string().trim().max(20).default("pcs"),
  assignedTo: objectId.nullable().optional(),
  estimatedCost: moneyInput.optional(),
  neededBy: day.optional().or(z.literal("")),
});

async function groceryData(req, b) {
  const out = { ...b };
  if (b.assignedTo) {
    if (!(await Membership.exists({ _id: b.assignedTo, home: req.home._id, status: "active" }))) throw badRequest("Assignee must be an active member");
  }
  if (b.estimatedCost !== undefined) out.estimatedCost = b.estimatedCost === "" ? 0 : toMinor(b.estimatedCost, { allowZero: true });
  if (b.neededBy === "") out.neededBy = undefined;
  return out;
}

router.post("/grocery", requirePerm("grocery.manage"), validate({ body: groceryInput }), async (req, res) => {
  const item = await GroceryItem.create({ ...(await groceryData(req, req.v.body)), home: req.home._id, createdBy: req.user._id });
  realtime.toHome(req.home._id, "grocery:changed", {});
  res.status(201).json({ item });
});

const gidParam = z.object({ gid: objectId }).passthrough();
const findItem = async (req) => {
  const item = await GroceryItem.findOne({ _id: req.params.gid, home: req.home._id });
  if (!item) throw notFound("Item not found");
  return item;
};

router.patch("/grocery/:gid", requirePerm("grocery.manage"), validate({ params: gidParam, body: groceryInput.partial() }), async (req, res) => {
  const item = await findItem(req);
  Object.assign(item, await groceryData(req, req.v.body));
  await item.save();
  realtime.toHome(req.home._id, "grocery:changed", {});
  res.json({ item });
});

router.delete("/grocery/:gid", requirePerm("grocery.manage"), validate({ params: gidParam }), async (req, res) => {
  const item = await findItem(req);
  if (item.expense) throw badRequest("This item is linked to an expense and cannot be deleted");
  await item.deleteOne();
  realtime.toHome(req.home._id, "grocery:changed", {});
  res.json({ ok: true });
});

// Mark purchased (manager or the assigned purchaser). Optionally records the
// actual cost as a grocery expense paid by the purchaser.
router.post(
  "/grocery/:gid/purchase",
  validate({ params: gidParam, body: z.object({ purchased: z.boolean().default(true), actualCost: moneyInput.optional(), createExpense: z.boolean().default(false) }) }),
  async (req, res) => {
    const item = await findItem(req);
    const isAssignee = item.assignedTo && String(item.assignedTo) === String(req.membership._id);
    if (!req.can("grocery.manage") && !isAssignee) throw forbidden();
    const b = req.v.body;
    if (!b.purchased) {
      if (item.expense) throw badRequest("Void the linked expense first");
      Object.assign(item, { purchased: false, purchasedAt: undefined, actualCost: undefined });
      await item.save();
      realtime.toHome(req.home._id, "grocery:changed", {});
      return res.json({ item });
    }
    item.purchased = true;
    item.purchasedAt = new Date();
    if (b.actualCost !== undefined && b.actualCost !== "") item.actualCost = toMinor(b.actualCost);
    if (b.createExpense) {
      if (!req.can("expenses.manage") && !req.can("expenses.meal")) throw forbidden("You cannot record expenses");
      if (!item.actualCost) throw badRequest("Enter the actual cost to record an expense");
      const expense = new Expense({ home: req.home._id, title: `Grocery: ${item.name}`, category: "groceries", amount: item.actualCost, day: todayIn(req.home.timezone), paidBy: item.assignedTo || req.membership._id, allocation: { mode: "meal_pool", memberships: [] }, recordedBy: req.user._id, history: [{ by: req.user._id, action: "created", changes: { from: "grocery list" } }] });
      await withTransaction(async (session) => {
        await postExpense(expense, req.user._id, session);
        await expense.save({ session });
      });
      item.expense = expense._id;
      await logActivity({ home: req.home, actor: req.user._id, action: "expense.created", summary: `${req.user.name} recorded grocery purchase "${item.name}" (${fmt(item.actualCost, req.home.currency)})`, targetKind: "expense", targetId: expense._id });
    }
    await item.save();
    realtime.toHome(req.home._id, "grocery:changed", {});
    res.json({ item });
  }
);

// ---------- calendar ----------
async function buildCalendar(req, from, to) {
  const home = req.home;
  const [events, periods, departures, absences, anns] = await Promise.all([
    CalendarEvent.find({ home: home._id, startDay: { $lte: to }, $or: [{ endDay: { $gte: from } }, { endDay: null, startDay: { $gte: from } }] }).populate("createdBy", "name"),
    MealPeriod.find({ home: home._id, startDay: { $lte: to }, endDay: { $gte: from } }),
    Membership.find({ home: home._id, status: "active", scheduledLeaveDay: { $gte: from, $lte: to } }).populate("user", "name"),
    Request.find({ home: home._id, type: "absence", status: "approved", startDay: { $lte: to }, endDay: { $gte: from } }).populate("user", "name"),
    Announcement.find({ home: home._id, eventDay: { $gte: from, $lte: to } }),
  ]);
  const out = [];
  events.forEach((e) => out.push({ id: String(e._id), kind: "event", title: e.title, description: e.description, startDay: e.startDay, endDay: e.endDay || e.startDay, time: e.time, editable: true }));
  periods.forEach((p) => {
    if (p.startDay >= from) out.push({ id: `ps-${p._id}`, kind: "meal", title: `${p.name} starts`, startDay: p.startDay, endDay: p.startDay });
    if (p.endDay <= to) out.push({ id: `pe-${p._id}`, kind: "meal", title: `${p.name} ends`, startDay: p.endDay, endDay: p.endDay });
  });
  departures.forEach((m) => out.push({ id: `d-${m._id}`, kind: "departure", title: `${m.user.name} leaves`, startDay: m.scheduledLeaveDay, endDay: m.scheduledLeaveDay }));
  absences.forEach((r) => out.push({ id: `a-${r._id}`, kind: "absence", title: `${r.user.name} away`, startDay: r.startDay, endDay: r.endDay }));
  anns.forEach((a) => out.push({ id: `n-${a._id}`, kind: "announcement", title: a.title, startDay: a.eventDay, endDay: a.eventDay }));
  // Payment due day for each month in range.
  const dueDay = String(home.settings.paymentDueDay).padStart(2, "0");
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addDays(`${m}-28`, 7).slice(0, 7)) {
    const d = `${m}-${dueDay}`;
    if (d >= from && d <= to) out.push({ id: `pay-${m}`, kind: "payment", title: "Payment deadline", startDay: d, endDay: d });
  }
  return out.sort((a, b) => a.startDay.localeCompare(b.startDay));
}

const rangeQ = z.object({ from: day, to: day }).refine((v) => isValidDay(v.from) && isValidDay(v.to) && v.from <= v.to && diffDays(v.from, v.to) <= 100, "Invalid date range");

router.get("/calendar", validate({ query: rangeQ }), async (req, res) => {
  res.json({ items: await buildCalendar(req, req.v.query.from, req.v.query.to) });
});

const eventInput = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional(), startDay: day, endDay: day.optional().or(z.literal("")), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")) });
const cleanEvent = (b) => {
  const out = { ...b, endDay: b.endDay || undefined, time: b.time || undefined };
  if (!isValidDay(out.startDay) || (out.endDay && (!isValidDay(out.endDay) || out.endDay < out.startDay))) throw badRequest("Invalid dates");
  return out;
};

router.post("/calendar/events", requirePerm("calendar.manage"), validate({ body: eventInput }), async (req, res) => {
  const e = await CalendarEvent.create({ ...cleanEvent(req.v.body), home: req.home._id, createdBy: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "calendar.created", summary: `${req.user.name} added event "${e.title}" on ${e.startDay}` });
  res.status(201).json({ event: e });
});

const evParam = z.object({ evid: objectId }).passthrough();
router.patch("/calendar/events/:evid", requirePerm("calendar.manage"), validate({ params: evParam, body: eventInput }), async (req, res) => {
  const e = await CalendarEvent.findOne({ _id: req.params.evid, home: req.home._id });
  if (!e) throw notFound("Event not found");
  Object.assign(e, cleanEvent(req.v.body));
  await e.save();
  res.json({ event: e });
});

router.delete("/calendar/events/:evid", requirePerm("calendar.manage"), validate({ params: evParam }), async (req, res) => {
  const e = await CalendarEvent.findOneAndDelete({ _id: req.params.evid, home: req.home._id });
  if (!e) throw notFound("Event not found");
  res.json({ ok: true });
});

// ---------- activity ----------
router.get("/activity", requirePerm("activity.view"), validate({ query: z.object({ before: z.string().datetime().optional(), action: z.string().max(40).optional() }) }), async (req, res) => {
  const filter = { home: req.home._id };
  if (req.v.query.before) filter.createdAt = { $lt: new Date(req.v.query.before) };
  if (req.v.query.action) filter.action = { $regex: `^${req.v.query.action.replace(/[^\w.]/g, "")}` };
  const items = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(50).populate("actor", "name avatarUrl");
  res.json({ items, hasMore: items.length === 50 });
});

// ---------- reports ----------
const REPORTS = ["monthly-financial", "member-payments", "meal-consumption", "expense-breakdown", "outstanding-dues", "guest-meals"];

router.get(
  "/reports/:kind",
  requirePerm("reports.view"),
  validate({ params: z.object({ kind: z.enum(REPORTS) }).passthrough(), query: monthQ.extend({ format: z.enum(["json", "csv"]).default("json") }) }),
  async (req, res) => {
    const home = req.home;
    const month = req.v.query.month || todayIn(home.timezone).slice(0, 7);
    const { from, to } = monthRange(month);
    const cur = home.currency;
    const money = (m) => (m / 100).toFixed(2);
    let headers, rows, summary = {};

    const members = await Membership.find({ home: home._id, status: { $in: ["active", "left", "removed"] } }).populate("user", "name email");
    const nameOf = new Map(members.map((m) => [String(m._id), m.user?.name || "Unknown"]));
    const kind = req.v.params.kind;

    if (kind === "monthly-financial" || kind === "expense-breakdown") {
      const exps = await Expense.find({ home: home._id, status: "active", day: { $gte: from, $lte: to } }).sort({ day: 1 });
      const byCat = {};
      exps.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
      if (kind === "expense-breakdown") {
        headers = ["Category", `Amount (${cur})`, "Share %"];
        const total = Object.values(byCat).reduce((a, b) => a + b, 0);
        rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, money(v), total ? ((v / total) * 100).toFixed(1) : "0"]);
        summary = { total, byCategory: byCat };
      } else {
        const ledger = await LedgerEntry.aggregate([{ $match: { home: home._id, status: "posted", day: { $gte: from, $lte: to } } }, { $group: { _id: { type: "$type", dir: "$direction" }, total: { $sum: "$amount" } } }]);
        headers = ["Date", "Title", "Category", `Amount (${cur})`, "Paid by", "Split"];
        rows = exps.map((e) => [e.day, e.title, e.category, money(e.amount), e.paidBy ? nameOf.get(String(e.paidBy)) : "Home fund", e.allocation.mode]);
        const sum = (type, dir) => ledger.filter((l) => l._id.type === type && (!dir || l._id.dir === dir)).reduce((a, l) => a + (l._id.dir === "credit" ? l.total : -l.total), 0);
        summary = { totalExpenses: exps.reduce((a, e) => a + e.amount, 0), byCategory: byCat, paymentsCollected: sum("payment"), mealCharges: -sum("meal_charge"), expenseShares: -sum("expense_share") };
      }
    } else if (kind === "member-payments") {
      const pays = await LedgerEntry.find({ home: home._id, type: "payment", status: "posted", day: { $gte: from, $lte: to } }).sort({ day: 1 }).populate("recordedBy", "name");
      headers = ["Date", "Member", `Amount (${cur})`, "Method", "Description", "Recorded by", "Reversed"];
      rows = pays.map((p) => [p.day, nameOf.get(String(p.membership)), money(p.amount), p.method, p.description, p.recordedBy?.name, p.reversedBy ? "yes" : ""]);
      const perMember = {};
      pays.filter((p) => !p.reversedBy).forEach((p) => (perMember[nameOf.get(String(p.membership))] = (perMember[nameOf.get(String(p.membership))] || 0) + p.amount));
      summary = { total: pays.filter((p) => !p.reversedBy).reduce((a, p) => a + p.amount, 0), perMember };
    } else if (kind === "meal-consumption" || kind === "guest-meals") {
      const s = await computePeriod(home, { startDay: from, endDay: to });
      const types = s.mealTypes;
      if (kind === "meal-consumption") {
        headers = ["Member", ...types.map((t) => t.label), "Weighted meals", "Guest meals", `Estimated cost (${cur})`];
        rows = s.members.map((m) => [m.user?.name, ...types.map((t) => m.counts[t.key] || 0), m.meals, m.guestMeals, money(m.charge)]);
      } else {
        headers = ["Member", ...types.map((t) => `${t.label} guests`), "Weighted guest meals"];
        rows = s.members.filter((m) => m.guestMeals > 0).map((m) => [m.user?.name, ...types.map((t) => m.guestCounts[t.key] || 0), m.guestMeals]);
      }
      summary = { rate: s.rate, totalExpense: s.totalExpense, memberMeals: s.memberMeals, guestMeals: s.guestMeals, chargeableMeals: s.chargeableMeals };
    } else if (kind === "outstanding-dues") {
      const bal = await balances(home._id);
      headers = ["Member", "Status", `Credits (${cur})`, `Charges (${cur})`, `Balance (${cur})`, "Position"];
      rows = members
        .map((m) => ({ m, b: bal[String(m._id)] || emptyBalance() }))
        .filter(({ m, b }) => m.status === "active" || b.balance !== 0)
        .sort((a, b) => a.b.balance - b.b.balance)
        .map(({ m, b }) => [m.user?.name, m.status, money(b.credits), money(b.debits), money(b.balance), b.balance < 0 ? "Due" : b.balance > 0 ? "Advance" : "Settled"]);
      summary = { totalDue: Object.values(bal).filter((b) => b.balance < 0).reduce((a, b) => a - b.balance, 0) };
    }

    if (req.v.query.format === "csv") return sendCsv(res, `${kind}-${month}.csv`, headers, rows);
    res.json({ kind, month, currency: cur, headers, rows, summary });
  }
);

module.exports = router;
