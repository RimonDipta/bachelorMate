// Recurring costs (rent, internet, cleaner…). Due occurrences are posted as
// normal expenses, so they flow through the same ledger, reports and audit
// trail. Posting is idempotent: a unique index on (template, day) means an
// occurrence can never be charged twice, even if two triggers race.
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const { Expense, RecurringExpense } = require("../models/Finance");
const { allocate } = require("../lib/money");
const { todayIn, addDays } = require("../lib/dates");
const { withTransaction } = require("../lib/transaction");
const { postExpense } = require("./ledger");
const { notify } = require("./notify");
const { logActivity } = require("./activity");
const realtime = require("./realtime");

const pad = (n) => String(n).padStart(2, "0");
const weekdayOf = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();
const nextMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
};

/** Occurrence days of a template after `afterDay` (exclusive) up to `upTo` (inclusive). */
function occurrences(t, upTo, afterDay = t.lastPostedDay || "", limit = 36) {
  const out = [];
  const end = t.endDay && t.endDay < upTo ? t.endDay : upTo;
  if (t.frequency === "weekly") {
    let d = t.startDay;
    while (weekdayOf(d) !== t.weekday) d = addDays(d, 1);
    for (; d <= end && out.length < limit; d = addDays(d, 7)) if (d > afterDay) out.push(d);
  } else {
    for (let ym = t.startDay.slice(0, 7), i = 0; i < 600 && out.length < limit; ym = nextMonth(ym), i++) {
      const d = `${ym}-${pad(t.dayOfMonth)}`;
      if (d > end) break;
      if (d >= t.startDay && d > afterDay) out.push(d);
    }
  }
  return out;
}

/** The next occurrence that hasn't been posted yet (may already be due). */
function nextOccurrence(t) {
  return occurrences(t, "9999-12-31", t.lastPostedDay || "", 1)[0] || null;
}

const periodLabel = (t, day) =>
  t.frequency === "weekly"
    ? `week of ${new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Resolves who pays what for one occurrence, using current active members.
 * Members who have left are never charged. Returns { amount, shares }.
 */
async function resolveShares(t, activeIds) {
  const active = new Set(activeIds.map(String));
  const a = t.allocation;
  if (a.mode === "none") return { amount: t.amount, shares: [] };
  if (a.mode === "custom") {
    const shares = (a.shares || []).filter((s) => active.has(String(s.membership)) && s.amount > 0).map((s) => ({ membership: s.membership, amount: s.amount }));
    return { amount: shares.reduce((x, s) => x + s.amount, 0), shares };
  }
  const ids = a.allMembers ? activeIds : (a.memberships || []).filter((id) => active.has(String(id)));
  if (!ids.length) return { amount: 0, shares: [] };
  const parts = allocate(t.amount, ids.map(() => 1));
  return { amount: t.amount, shares: ids.map((id, i) => ({ membership: id, amount: parts[i] })) };
}

async function postOccurrence(home, t, day, activeIds, actorId) {
  const { amount, shares } = await resolveShares(t, activeIds);
  if (amount <= 0) return null;
  const paidBy = t.paidBy && activeIds.some((id) => String(id) === String(t.paidBy)) ? t.paidBy : null;
  const by = actorId || t.createdBy;
  const expense = new Expense({
    home: home._id,
    title: `${t.title} · ${periodLabel(t, day)}`,
    category: t.category,
    amount,
    day,
    paidBy,
    allocation: t.allocation.mode === "none" ? { mode: "none", memberships: [], shares: [] } : { mode: "custom", memberships: [], shares },
    recurring: { template: t._id, day },
    notes: t.notes,
    recordedBy: by,
    history: [{ by, action: "created", changes: { from: "recurring cost" } }],
  });
  try {
    await withTransaction(async (session) => {
      await postExpense(expense, by, session);
      await expense.save({ session });
    });
  } catch (err) {
    if (err.code === 11000) return null; // already posted by another trigger
    throw err;
  }
  // Tell each member what they were charged.
  const members = await Membership.find({ _id: { $in: shares.map((s) => s.membership) } }).select("user");
  const userOf = new Map(members.map((m) => [String(m._id), m.user]));
  for (const s of shares) {
    const user = userOf.get(String(s.membership));
    if (user) {
      await notify([user], {
        type: "expense",
        home: home._id,
        title: `${expense.title}: your share is ${(s.amount / 100).toFixed(2)} ${home.currency}`,
        body: "Added automatically from a recurring cost.",
        link: `/h/${home._id}/finance/me`,
        email: false,
      });
    }
  }
  await logActivity({ home, actor: by, action: "expense.recurring_posted", summary: `Recurring cost posted: ${expense.title} (${(amount / 100).toFixed(2)} ${home.currency})`, targetKind: "expense", targetId: expense._id });
  return expense;
}

const lastSync = new Map(); // homeId -> timestamp (throttles on-request syncing)

/** Posts every due occurrence for one home. Returns the number of expenses posted. */
async function syncHome(home, { force = false, actorId } = {}) {
  const key = String(home._id);
  if (!force && Date.now() - (lastSync.get(key) || 0) < 5 * 60 * 1000) return 0;
  lastSync.set(key, Date.now());
  if (home.status !== "active") return 0;
  const templates = await RecurringExpense.find({ home: home._id, active: true });
  if (!templates.length) return 0;
  const today = todayIn(home.timezone);
  const activeIds = (await Membership.find({ home: home._id, status: "active" }).select("_id")).map((m) => m._id);
  let posted = 0;
  for (const t of templates) {
    const due = occurrences(t, today);
    for (const day of due) {
      if (await postOccurrence(home, t, day, activeIds, actorId)) posted++;
      t.lastPostedDay = day;
    }
    if (due.length) await t.save();
  }
  if (posted) realtime.toHome(home._id, "finance:changed", {});
  return posted;
}

/** Background sweep across all homes (run on an interval by server.js). */
async function syncAllHomes() {
  const homeIds = await RecurringExpense.distinct("home", { active: true });
  let total = 0;
  for (const id of homeIds) {
    const home = await Home.findById(id);
    if (home) total += await syncHome(home, { force: true });
  }
  return total;
}

module.exports = { occurrences, nextOccurrence, resolveShares, syncHome, syncAllHomes, periodLabel };
