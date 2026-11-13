// Financial management: member ledgers, payments, adjustments, expenses.
const express = require("express");
const path = require("path");
const fs = require("fs");
const Membership = require("../models/Membership");
const { LedgerEntry, Expense, EXPENSE_CATEGORIES, MEAL_CATEGORIES } = require("../models/Finance");
const { validate, z, objectId, day, badRequest, notFound, forbidden, conflict, moneyInput } = require("../lib/http");
const { toMinor } = require("../lib/money");
const { todayIn, isValidDay, monthRange } = require("../lib/dates");
const { withTransaction } = require("../lib/transaction");
const { sendCsv } = require("../lib/csv");
const env = require("../config/env");
const { requirePerm } = require("../middleware/home");
const { makeUploader } = require("../middleware/upload");
const { balances, emptyBalance, postEntries, reverseEntry, reverseByRef, postExpense } = require("../services/ledger");
const { notify, notifyPermitted } = require("../services/notify");
const { logActivity } = require("../services/activity");
const { assertDaysEditable } = require("./meals");
const realtime = require("../services/realtime");

const router = express.Router({ mergeParams: true });
const receiptUpload = makeUploader("receipts", { allowPdf: true });

const METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "card", "other"];
const fmt = (minor, cur) => `${(minor / 100).toFixed(2)} ${cur}`;

async function memberInHome(home, id, statuses = ["active"]) {
  const m = await Membership.findOne({ _id: id, home: home._id, status: { $in: statuses } }).populate("user", "name");
  if (!m) throw badRequest("Member not found in this home");
  return m;
}

// ---------- overview ----------
router.get("/finance/overview", validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }) }), async (req, res) => {
  const home = req.home;
  const month = req.v.query.month || todayIn(home.timezone).slice(0, 7);
  const { from, to } = monthRange(month);
  const homeId = home._id;
  const full = req.can("finance.view_all");

  const [bal, expensesAll, collectedAll, monthExpenses, monthCollected] = await Promise.all([
    balances(homeId),
    Expense.aggregate([{ $match: { home: homeId, status: "active" } }, { $group: { _id: { fund: { $eq: ["$paidBy", null] } }, total: { $sum: "$amount" } } }]),
    LedgerEntry.aggregate([{ $match: { home: homeId, status: "posted", type: "payment" } }, { $group: { _id: "$direction", total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { home: homeId, status: "active", day: { $gte: from, $lte: to } } }, { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    LedgerEntry.aggregate([{ $match: { home: homeId, status: "posted", type: "payment", day: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);

  const members = await Membership.find({ home: homeId, status: { $in: ["active", "left", "removed"] } }).populate("user", "name avatarUrl");
  let dues = 0, advances = 0;
  const accounts = members
    .map((m) => {
      const b = bal[String(m._id)] || emptyBalance();
      if (b.balance < 0) dues += -b.balance;
      else advances += b.balance;
      return { membership: m._id, user: m.user, status: m.status, ...b, payable: Math.max(0, -b.balance) };
    })
    .filter((a) => a.status === "active" || a.balance !== 0);

  const totalExpenses = expensesAll.reduce((a, r) => a + r.total, 0);
  const fundExpenses = expensesAll.find((r) => r._id.fund)?.total || 0;
  const collected = collectedAll.reduce((a, r) => a + (r._id === "credit" ? r.total : -r.total), 0);
  const byCategory = Object.fromEntries(monthExpenses.map((r) => [r._id, r.total]));
  const monthMeal = MEAL_CATEGORIES.reduce((a, c) => a + (byCategory[c] || 0), 0);
  const monthTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);

  // Six-month trend.
  const [y, mo] = month.split("-").map(Number);
  const months = [...Array(6)].map((_, i) => {
    const d = new Date(Date.UTC(y, mo - 1 - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const trendFrom = `${months[0]}-01`;
  const [trendExp, trendPay] = await Promise.all([
    Expense.aggregate([{ $match: { home: homeId, status: "active", day: { $gte: trendFrom, $lte: to } } }, { $group: { _id: { m: { $substr: ["$day", 0, 7] }, meal: { $in: ["$category", MEAL_CATEGORIES] } }, total: { $sum: "$amount" } } }]),
    LedgerEntry.aggregate([{ $match: { home: homeId, status: "posted", type: "payment", direction: "credit", day: { $gte: trendFrom, $lte: to } } }, { $group: { _id: { $substr: ["$day", 0, 7] }, total: { $sum: "$amount" } } }]),
  ]);
  const trend = months.map((m) => ({
    month: m,
    meal: trendExp.find((r) => r._id.m === m && r._id.meal)?.total || 0,
    other: trendExp.find((r) => r._id.m === m && !r._id.meal)?.total || 0,
    collected: trendPay.find((r) => r._id === m)?.total || 0,
  }));

  const mine = bal[String(req.membership._id)] || emptyBalance();
  const pendingPayments = await LedgerEntry.countDocuments({ home: homeId, status: "pending", ...(full ? {} : { membership: req.membership._id }) });

  res.json({
    month,
    currency: home.currency,
    full,
    mine: { ...mine, payable: Math.max(0, -mine.balance) },
    pendingPayments,
    totals: {
      totalExpenses,
      collected,
      fundBalance: collected - fundExpenses,
      outstandingDues: full ? dues : undefined,
      advances: full ? advances : undefined,
      monthTotal,
      monthMeal,
      monthOther: monthTotal - monthMeal,
      monthCollected: monthCollected[0]?.total || 0,
    },
    byCategory,
    trend,
    accounts: full ? accounts.sort((a, b) => a.balance - b.balance) : undefined,
  });
});

// ---------- member accounts ----------
/**
 * What a member owes right now and why: the balance carried in from before
 * this month, plus this month's charges and credits.
 *   payable = max(0, -balance)   (advance credit already offsets new charges)
 */
async function monthStatement(home, membershipId, b) {
  const month = todayIn(home.timezone).slice(0, 7);
  const { from } = monthRange(month);
  const rows = await LedgerEntry.aggregate([
    { $match: { home: home._id, membership: membershipId, status: "posted" } },
    { $group: { _id: { before: { $lt: ["$day", from] }, type: "$type", dir: "$direction" }, total: { $sum: "$amount" } } },
  ]);
  let opening = 0;
  const thisMonth = {};
  for (const r of rows) {
    const signed = r._id.dir === "credit" ? r.total : -r.total;
    if (r._id.before) opening += signed;
    else thisMonth[r._id.type] = (thisMonth[r._id.type] || 0) + signed;
  }
  return { month, opening, thisMonth, balance: b.balance, payable: Math.max(0, -b.balance), advance: Math.max(0, b.balance) };
}

router.get("/finance/accounts/:mid", validate({ params: z.object({ mid: objectId }).passthrough() }), async (req, res) => {
  const self = String(req.params.mid) === String(req.membership._id);
  if (!self && !req.can("finance.view_all")) throw forbidden();
  const m = await Membership.findOne({ _id: req.params.mid, home: req.home._id }).populate("user", "name avatarUrl email");
  if (!m) throw notFound("Member not found");
  const entries = await LedgerEntry.find({ home: req.home._id, membership: m._id }).sort({ day: -1, createdAt: -1 }).limit(500).populate("recordedBy", "name");
  const b = (await balances(req.home._id, [m._id]))[String(m._id)] || emptyBalance();
  // Running balance (oldest -> newest) so the statement is transparent.
  let running = 0;
  const withRunning = [...entries].reverse().map((e) => {
    if (e.status === "posted") running += e.direction === "credit" ? e.amount : -e.amount;
    return { ...e.toObject(), runningBalance: running };
  });
  res.json({ member: { _id: m._id, user: m.user, status: m.status, roles: m.roles, room: m.room }, balance: b, statement: await monthStatement(req.home, m._id, b), entries: withRunning.reverse() });
});

// ---------- transactions ----------
const txQuery = z.object({
  membershipId: objectId.optional(),
  type: z.string().optional(),
  status: z.enum(["pending", "posted", "rejected"]).optional(),
  from: day.optional(),
  to: day.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

function txFilter(req) {
  const { membershipId, type, status, from, to, q } = req.v.query;
  const filter = { home: req.home._id };
  if (!req.can("finance.view_all")) filter.membership = req.membership._id;
  else if (membershipId) filter.membership = membershipId;
  if (type) filter.type = { $in: type.split(",") };
  if (status) filter.status = status;
  if (from || to) filter.day = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (q) filter.description = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  return filter;
}

router.get("/finance/transactions", validate({ query: txQuery }), async (req, res) => {
  const filter = txFilter(req);
  const limit = 50;
  const [items, total] = await Promise.all([
    LedgerEntry.find(filter).sort({ day: -1, createdAt: -1 }).skip((req.v.query.page - 1) * limit).limit(limit).populate({ path: "membership", select: "user", populate: { path: "user", select: "name avatarUrl" } }).populate("recordedBy", "name"),
    LedgerEntry.countDocuments(filter),
  ]);
  res.json({ items, total, page: req.v.query.page, pages: Math.ceil(total / limit) });
});

router.get("/finance/transactions.csv", validate({ query: txQuery }), async (req, res) => {
  const items = await LedgerEntry.find(txFilter(req)).sort({ day: -1 }).limit(10000).populate({ path: "membership", select: "user", populate: { path: "user", select: "name" } }).populate("recordedBy", "name");
  sendCsv(
    res,
    `transactions-${req.home.name}.csv`,
    ["ID", "Date", "Member", "Type", "Direction", `Amount (${req.home.currency})`, "Status", "Method", "Description", "Recorded by", "Reversal of"],
    items.map((e) => [e._id, e.day, e.membership?.user?.name, e.type, e.direction, (e.amount / 100).toFixed(2), e.reversedBy ? "reversed" : e.status, e.method, e.description, e.recordedBy?.name, e.reversalOf])
  );
});

// ---------- payments ----------
const paymentFields = z.object({
  membershipId: objectId.optional(),
  amount: moneyInput,
  method: z.enum(METHODS).default("cash"),
  day: day.optional(),
  description: z.string().trim().max(300).optional(),
});

router.post("/finance/payments", ...receiptUpload("attachment"), validate({ body: paymentFields }), async (req, res) => {
  const b = req.v.body;
  const canRecord = req.can("finance.record");
  const targetId = b.membershipId || req.membership._id;
  const self = String(targetId) === String(req.membership._id);
  if (!self && !canRecord) throw forbidden("You can only submit your own payments");
  const member = await memberInHome(req.home, targetId, ["active", "left", "removed"]);
  const d = b.day || todayIn(req.home.timezone);
  if (!isValidDay(d)) throw badRequest("Invalid date");
  const status = canRecord ? "posted" : "pending";
  const [entry] = await postEntries([
    {
      home: req.home._id,
      membership: member._id,
      type: "payment",
      direction: "credit",
      amount: toMinor(b.amount),
      day: d,
      method: b.method,
      description: b.description || `Payment (${b.method})`,
      status,
      recordedBy: req.user._id,
      ...(canRecord ? { reviewedBy: req.user._id, reviewedAt: new Date() } : {}),
      attachment: req.file?.storedPath,
    },
  ]);
  if (status === "pending") {
    await notifyPermitted(req.home, "finance.record", { type: "payment", title: `${req.user.name} submitted a payment of ${fmt(entry.amount, req.home.currency)}`, body: "Confirm it once you've received the money.", link: `/h/${req.home._id}/finance/transactions?status=pending`, actor: req.user._id });
  } else if (!self) {
    await notify([member.user._id], { type: "payment", home: req.home._id, title: `Payment of ${fmt(entry.amount, req.home.currency)} recorded`, body: `Recorded by ${req.user.name}`, link: `/h/${req.home._id}/finance/me`, actor: req.user._id });
  }
  await logActivity({ home: req.home, actor: req.user._id, action: status === "posted" ? "payment.recorded" : "payment.submitted", summary: `${req.user.name} ${status === "posted" ? "recorded" : "submitted"} a payment of ${fmt(entry.amount, req.home.currency)} for ${member.user.name}`, targetKind: "ledger", targetId: entry._id });
  realtime.toHome(req.home._id, "finance:changed", {});
  res.status(201).json({ entry });
});

const entryParam = z.object({ eid: objectId }).passthrough();
const findEntry = async (req) => {
  const e = await LedgerEntry.findOne({ _id: req.params.eid, home: req.home._id }).populate({ path: "membership", select: "user", populate: { path: "user", select: "name" } });
  if (!e) throw notFound("Transaction not found");
  return e;
};

router.post("/finance/entries/:eid/approve", requirePerm("finance.record"), validate({ params: entryParam }), async (req, res) => {
  const e = await findEntry(req);
  if (e.status !== "pending") throw conflict("This payment has already been reviewed");
  e.status = "posted";
  e.reviewedBy = req.user._id;
  e.reviewedAt = new Date();
  await e.save();
  await notify([e.membership.user._id], { type: "payment", home: req.home._id, title: `Your payment of ${fmt(e.amount, req.home.currency)} was confirmed`, link: `/h/${req.home._id}/finance/me`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "payment.approved", summary: `${req.user.name} confirmed ${e.membership.user.name}'s payment of ${fmt(e.amount, req.home.currency)}`, targetKind: "ledger", targetId: e._id });
  realtime.toHome(req.home._id, "finance:changed", {});
  res.json({ entry: e });
});

router.post("/finance/entries/:eid/reject", requirePerm("finance.record"), validate({ params: entryParam, body: z.object({ reason: z.string().trim().max(300).optional() }) }), async (req, res) => {
  const e = await findEntry(req);
  if (e.status !== "pending") throw conflict("This payment has already been reviewed");
  e.status = "rejected";
  e.reviewedBy = req.user._id;
  e.reviewedAt = new Date();
  if (req.v.body.reason) e.description = `${e.description} — rejected: ${req.v.body.reason}`;
  await e.save();
  await notify([e.membership.user._id], { type: "payment", home: req.home._id, title: `Your payment of ${fmt(e.amount, req.home.currency)} was not confirmed`, body: req.v.body.reason, link: `/h/${req.home._id}/finance/me`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "payment.rejected", summary: `${req.user.name} rejected a payment from ${e.membership.user.name}`, targetKind: "ledger", targetId: e._id });
  res.json({ entry: e });
});

router.post("/finance/entries/:eid/reverse", requirePerm("finance.record"), validate({ params: entryParam, body: z.object({ reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
  const e = await findEntry(req);
  if (e.refKind === "expense") throw badRequest("Edit or void the expense instead");
  if (e.refKind === "meal_period") throw badRequest("Reopen the meal period instead");
  const rev = await withTransaction((session) => reverseEntry(e, req.user._id, req.v.body.reason, session));
  await logActivity({ home: req.home, actor: req.user._id, action: "ledger.reversed", summary: `${req.user.name} reversed a ${e.type} of ${fmt(e.amount, req.home.currency)} for ${e.membership.user.name}: ${req.v.body.reason}`, targetKind: "ledger", targetId: e._id });
  realtime.toHome(req.home._id, "finance:changed", {});
  res.json({ reversal: rev });
});

router.post(
  "/finance/adjustments",
  requirePerm("finance.record"),
  validate({ body: z.object({ membershipId: objectId, direction: z.enum(["credit", "debit"]), amount: moneyInput, type: z.enum(["adjustment", "opening_balance"]).default("adjustment"), description: z.string().trim().min(3).max(300), day: day.optional() }) }),
  async (req, res) => {
    const b = req.v.body;
    const member = await memberInHome(req.home, b.membershipId, ["active", "left", "removed"]);
    const [entry] = await postEntries([{ home: req.home._id, membership: member._id, type: b.type, direction: b.direction, amount: toMinor(b.amount), day: b.day || todayIn(req.home.timezone), description: b.description, recordedBy: req.user._id }]);
    await notify([member.user._id], { type: "payment", home: req.home._id, title: `${b.direction === "credit" ? "Credit" : "Charge"} of ${fmt(entry.amount, req.home.currency)} added to your account`, body: b.description, link: `/h/${req.home._id}/finance/me`, actor: req.user._id });
    await logActivity({ home: req.home, actor: req.user._id, action: "ledger.adjusted", summary: `${req.user.name} added a ${b.direction} ${b.type.replace("_", " ")} of ${fmt(entry.amount, req.home.currency)} for ${member.user.name}`, targetKind: "ledger", targetId: entry._id });
    realtime.toHome(req.home._id, "finance:changed", {});
    res.status(201).json({ entry });
  }
);

router.post("/finance/reminders", requirePerm("finance.record"), async (req, res) => {
  const members = await Membership.find({ home: req.home._id, status: "active" });
  const bal = await balances(req.home._id);
  const due = members.filter((m) => (bal[String(m._id)]?.balance || 0) < 0);
  for (const m of due) {
    await notify([m.user], { type: "payment_reminder", home: req.home._id, title: `Payment reminder for ${req.home.name}`, body: `You have outstanding dues of ${fmt(-bal[String(m._id)].balance, req.home.currency)}. Please pay by day ${req.home.settings.paymentDueDay} of the month.`, link: `/h/${req.home._id}/finance/me`, actor: req.user._id });
  }
  await logActivity({ home: req.home, actor: req.user._id, action: "payment.reminders_sent", summary: `${req.user.name} sent payment reminders to ${due.length} member(s)` });
  res.json({ reminded: due.length });
});

// ---------- expenses ----------
const canSeeExpenses = (req) => req.can("expenses.view") || req.can("expenses.manage") || req.can("expenses.meal") || req.can("finance.view_all");
const canManageCategory = (req, category) => req.can("expenses.manage") || (req.can("expenses.meal") && MEAL_CATEGORIES.includes(category));

router.get(
  "/expenses",
  validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional(), from: day.optional(), to: day.optional(), category: z.enum(EXPENSE_CATEGORIES).optional(), status: z.enum(["active", "void", "all"]).default("active"), q: z.string().trim().max(80).optional() }) }),
  async (req, res) => {
    if (!canSeeExpenses(req)) throw forbidden();
    const { month, from, to, category, status, q } = req.v.query;
    const filter = { home: req.home._id };
    if (status !== "all") filter.status = status;
    if (category) filter.category = category;
    const r = month ? monthRange(month) : { from, to };
    if (r.from || r.to) filter.day = { ...(r.from ? { $gte: r.from } : {}), ...(r.to ? { $lte: r.to } : {}) };
    if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const expenses = await Expense.find(filter).sort({ day: -1, createdAt: -1 }).limit(500).populate({ path: "paidBy", select: "user", populate: { path: "user", select: "name avatarUrl" } }).populate("recordedBy", "name").populate("history.by", "name");
    res.json({ expenses, total: expenses.filter((e) => e.status === "active").reduce((a, e) => a + e.amount, 0) });
  }
);

const listField = z.preprocess((v) => {
  if (typeof v === "string") {
    try {
      return v ? JSON.parse(v) : [];
    } catch {
      return v.split(",");
    }
  }
  return v;
}, z.array(objectId).max(100));

const expenseFields = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: moneyInput,
  day: day,
  paidBy: z.union([objectId, z.literal(""), z.null()]).optional(),
  allocationMode: z.enum(["meal_pool", "equal", "selected", "custom", "none"]).optional(),
  memberships: listField.optional(),
  // custom mode: [{ membershipId, amount }] (JSON string when sent as multipart)
  shares: z
    .preprocess((v) => {
      if (typeof v !== "string") return v;
      try {
        return v ? JSON.parse(v) : [];
      } catch {
        return null;
      }
    }, z.array(z.object({ membershipId: objectId, amount: moneyInput })).max(100))
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

async function buildExpense(req, b, current) {
  if (!isValidDay(b.day)) throw badRequest("Invalid date");
  if (!canManageCategory(req, b.category)) throw forbidden("You can only record grocery / meal expenses");
  const isMeal = MEAL_CATEGORIES.includes(b.category);
  const mode = isMeal ? "meal_pool" : b.allocationMode && b.allocationMode !== "meal_pool" ? b.allocationMode : "equal";
  let memberships = [];
  if (mode === "selected") {
    if (!b.memberships?.length) throw badRequest("Choose at least one member to split with");
    const count = await Membership.countDocuments({ _id: { $in: b.memberships }, home: req.home._id, status: "active" });
    if (count !== new Set(b.memberships).size) throw badRequest("Split members must be active members of this home");
    memberships = [...new Set(b.memberships)];
  }
  const amount = toMinor(b.amount);
  let shares = [];
  if (mode === "custom") {
    shares = (b.shares || []).map((s) => ({ membership: s.membershipId, amount: toMinor(s.amount, { allowZero: true }) }));
    const ids = shares.map((s) => String(s.membership));
    if (new Set(ids).size !== ids.length) throw badRequest("Each member can appear only once");
    const count = await Membership.countDocuments({ _id: { $in: ids }, home: req.home._id, status: "active" });
    if (count !== ids.length) throw badRequest("Split members must be active members of this home");
    const total = shares.reduce((a, s) => a + s.amount, 0);
    if (total !== amount) throw badRequest(`Custom amounts add up to ${fmt(total, req.home.currency)}, but the expense is ${fmt(amount, req.home.currency)}`);
  }
  let paidBy = null;
  if (b.paidBy) paidBy = (await memberInHome(req.home, b.paidBy, ["active", "left", "removed"]))._id;
  if (isMeal) await assertDaysEditable(req.home, [b.day, ...(current && MEAL_CATEGORIES.includes(current.category) ? [current.day] : [])]);
  return { title: b.title, category: b.category, amount, day: b.day, paidBy, allocation: { mode, memberships, shares }, notes: b.notes };
}

router.post("/expenses", ...receiptUpload("receipt"), validate({ body: expenseFields }), async (req, res) => {
  const data = await buildExpense(req, req.v.body);
  const expense = new Expense({ ...data, home: req.home._id, recordedBy: req.user._id, receipt: req.file?.storedPath, history: [{ by: req.user._id, action: "created" }] });
  await withTransaction(async (session) => {
    await postExpense(expense, req.user._id, session);
    await expense.save({ session });
  });
  await notifyPermitted(req.home, ["members.view"], { type: "expense", title: `New expense: ${expense.title}`, body: fmt(expense.amount, req.home.currency), link: `/h/${req.home._id}/finance/expenses`, actor: req.user._id, email: false });
  await logActivity({ home: req.home, actor: req.user._id, action: "expense.created", summary: `${req.user.name} added ${expense.category} expense "${expense.title}" (${fmt(expense.amount, req.home.currency)})`, targetKind: "expense", targetId: expense._id });
  realtime.toHome(req.home._id, "finance:changed", {});
  res.status(201).json({ expense });
});

const findExpense = async (req) => {
  const e = await Expense.findOne({ _id: req.params.xid, home: req.home._id });
  if (!e) throw notFound("Expense not found");
  return e;
};
const xidParam = z.object({ xid: objectId }).passthrough();

router.patch("/expenses/:xid", ...receiptUpload("receipt"), validate({ params: xidParam, body: expenseFields }), async (req, res) => {
  const expense = await findExpense(req);
  if (expense.status === "void") throw badRequest("Void expenses cannot be edited");
  if (!canManageCategory(req, expense.category)) throw forbidden();
  const data = await buildExpense(req, req.v.body, expense);
  const fields = ["title", "category", "amount", "day", "notes"];
  const changes = {};
  for (const f of fields) if (String(expense[f] ?? "") !== String(data[f] ?? "")) changes[f] = { from: expense[f], to: data[f] };
  if (String(expense.paidBy || "") !== String(data.paidBy || "")) changes.paidBy = { from: expense.paidBy, to: data.paidBy };
  const sharesKey = (list) => (list || []).map((s) => `${s.membership}:${s.amount}`).sort().join();
  const allocChanged =
    expense.allocation.mode !== data.allocation.mode ||
    (data.allocation.mode === "selected" && [...expense.allocation.memberships].map(String).sort().join() !== data.allocation.memberships.map(String).sort().join()) ||
    (data.allocation.mode === "custom" && sharesKey(expense.allocation.shares) !== sharesKey(data.allocation.shares));
  if (allocChanged) changes.allocation = { from: expense.allocation.mode, to: data.allocation.mode };
  if (req.file) changes.receipt = { to: "updated" };
  if (!Object.keys(changes).length) return res.json({ expense });

  const financial = ["amount", "day", "paidBy", "allocation", "category"].some((k) => changes[k]);
  await withTransaction(async (session) => {
    if (financial) await reverseByRef("expense", expense._id, req.user._id, "Expense edited", session);
    Object.assign(expense, data);
    if (req.file) expense.receipt = req.file.storedPath;
    expense.history.push({ by: req.user._id, action: "edited", changes });
    if (financial) await postExpense(expense, req.user._id, session);
    await expense.save({ session });
  });
  await logActivity({ home: req.home, actor: req.user._id, action: "expense.edited", summary: `${req.user.name} edited expense "${expense.title}" (${Object.keys(changes).join(", ")})`, targetKind: "expense", targetId: expense._id, meta: { changes } });
  realtime.toHome(req.home._id, "finance:changed", {});
  res.json({ expense });
});

router.post("/expenses/:xid/void", validate({ params: xidParam, body: z.object({ reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
  const expense = await findExpense(req);
  if (!canManageCategory(req, expense.category)) throw forbidden();
  if (expense.status === "void") throw conflict("Already void");
  if (MEAL_CATEGORIES.includes(expense.category)) await assertDaysEditable(req.home, [expense.day]);
  await withTransaction(async (session) => {
    await reverseByRef("expense", expense._id, req.user._id, `Expense voided: ${req.v.body.reason}`, session);
    expense.status = "void";
    expense.history.push({ by: req.user._id, action: "voided", changes: { reason: req.v.body.reason } });
    await expense.save({ session });
  });
  await logActivity({ home: req.home, actor: req.user._id, action: "expense.voided", summary: `${req.user.name} voided expense "${expense.title}": ${req.v.body.reason}`, targetKind: "expense", targetId: expense._id });
  realtime.toHome(req.home._id, "finance:changed", {});
  res.json({ expense });
});

// Receipts are only served to members of the home that owns them.
router.get("/files/receipts/:name", validate({ params: z.object({ name: z.string().regex(/^[\w-]+\.(jpg|png|webp|pdf)$/) }).passthrough() }), async (req, res) => {
  const stored = `receipts/${req.v.params.name}`;
  const owned = (await Expense.exists({ home: req.home._id, receipt: stored })) || (await LedgerEntry.exists({ home: req.home._id, attachment: stored }));
  if (!owned) throw notFound("File not found");
  const file = path.join(env.UPLOAD_DIR, "receipts", req.v.params.name);
  if (!fs.existsSync(file)) throw notFound("File not found");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(file);
});

module.exports = router;
