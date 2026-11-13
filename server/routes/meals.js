// Meal management: daily entries, defaults, periods and accounting.
const express = require("express");
const Membership = require("../models/Membership");
const { MealEntry, MealPeriod } = require("../models/Meal");
const { validate, z, objectId, day, badRequest, notFound, conflict } = require("../lib/http");
const { isValidDay, eachDay, todayIn, diffDays, monthRange } = require("../lib/dates");
const { withTransaction } = require("../lib/transaction");
const { requirePerm, requireAdmin } = require("../middleware/home");
const { computePeriod, defaultCountsFor } = require("../services/meals");
const { postEntries, reverseByRef } = require("../services/ledger");
const { logActivity } = require("../services/activity");
const { notify } = require("../services/notify");
const realtime = require("../services/realtime");

const router = express.Router({ mergeParams: true });

const range = z
  .object({ from: day, to: day })
  .refine((v) => isValidDay(v.from) && isValidDay(v.to) && v.from <= v.to, "Invalid date range")
  .refine((v) => diffDays(v.from, v.to) <= 62, "Range can be at most 62 days");

async function assertDaysEditable(home, days) {
  if (!days.length) return;
  const sorted = [...days].sort();
  const closed = await MealPeriod.findOne({
    home: home._id,
    status: "closed",
    startDay: { $lte: sorted[sorted.length - 1] },
    endDay: { $gte: sorted[0] },
  });
  if (closed && days.some((d) => d >= closed.startDay && d <= closed.endDay)) {
    throw badRequest(`"${closed.name}" is closed. Reopen it before changing its meals.`);
  }
}

const toObj = (map) => (map instanceof Map ? Object.fromEntries(map) : map || {});

/** Ensures an entry exists for (membership, day), created from defaults. */
async function ensureEntry(home, membership, d, userId) {
  return MealEntry.findOneAndUpdate(
    { home: home._id, membership: membership._id, day: d },
    { $setOnInsert: { counts: membership.mealsEnabled === false ? {} : defaultCountsFor(membership, home), guests: {}, updatedBy: userId } },
    { upsert: true, new: true }
  );
}

/** Used by the request center when a meal-off / absence is approved. */
async function applyMealOff(home, membership, days, mealTypes, userId) {
  await assertDaysEditable(home, days);
  const keys = mealTypes?.length ? mealTypes : home.settings.mealTypes.map((t) => t.key);
  for (const d of days) {
    const entry = await ensureEntry(home, membership, d, userId);
    keys.forEach((k) => entry.counts.set(k, 0));
    entry.updatedBy = userId;
    await entry.save();
  }
}

async function applyGuestMeal(home, membership, d, mealType, count, userId) {
  await assertDaysEditable(home, [d]);
  const entry = await ensureEntry(home, membership, d, userId);
  entry.guests.set(mealType, (entry.guests.get(mealType) || 0) + count);
  entry.updatedBy = userId;
  await entry.save();
}

// Daily grid: every active member's meals for a date range.
router.get("/meals/days", validate({ query: range }), async (req, res) => {
  const { from, to } = req.v.query;
  const [members, entries, periods] = await Promise.all([
    Membership.find({ home: req.home._id, status: "active" }).populate("user", "name avatarUrl").sort({ createdAt: 1 }),
    MealEntry.find({ home: req.home._id, day: { $gte: from, $lte: to } }),
    MealPeriod.find({ home: req.home._id, startDay: { $lte: to }, endDay: { $gte: from } }).select("name startDay endDay status"),
  ]);
  res.json({
    days: eachDay(from, to),
    mealTypes: req.home.settings.mealTypes,
    members: members.map((m) => ({ _id: m._id, user: m.user, room: m.room, mealsEnabled: m.mealsEnabled, defaults: defaultCountsFor(m, req.home) })),
    entries: entries.map((e) => ({ _id: e._id, membership: e.membership, day: e.day, counts: toObj(e.counts), guests: toObj(e.guests), note: e.note })),
    periods,
    today: todayIn(req.home.timezone),
  });
});

const countMap = z.record(z.string(), z.number().min(0).max(20));

router.put(
  "/meals/entries",
  requirePerm("meals.manage"),
  validate({
    body: z.object({
      entries: z
        .array(z.object({ membershipId: objectId, day, counts: countMap.optional(), guests: countMap.optional(), note: z.string().trim().max(200).optional() }))
        .min(1)
        .max(500),
    }),
  }),
  async (req, res) => {
    const { entries } = req.v.body;
    const keys = new Set(req.home.settings.mealTypes.map((t) => t.key));
    for (const e of entries) {
      if (!isValidDay(e.day)) throw badRequest(`Invalid day ${e.day}`);
      for (const k of [...Object.keys(e.counts || {}), ...Object.keys(e.guests || {})]) if (!keys.has(k)) throw badRequest(`Unknown meal type "${k}"`);
    }
    await assertDaysEditable(req.home, entries.map((e) => e.day));
    const ids = [...new Set(entries.map((e) => e.membershipId))];
    const valid = await Membership.countDocuments({ _id: { $in: ids }, home: req.home._id, status: { $in: ["active", "left", "removed"] } });
    if (valid !== ids.length) throw badRequest("One or more members do not belong to this home");

    await MealEntry.bulkWrite(
      entries.map((e) => {
        const set = { updatedBy: req.user._id };
        for (const [k, v] of Object.entries(e.counts || {})) set[`counts.${k}`] = v;
        for (const [k, v] of Object.entries(e.guests || {})) set[`guests.${k}`] = v;
        if (e.note !== undefined) set.note = e.note;
        return { updateOne: { filter: { home: req.home._id, membership: e.membershipId, day: e.day }, update: { $set: set }, upsert: true } };
      })
    );
    const days = [...new Set(entries.map((e) => e.day))].sort();
    await logActivity({ home: req.home, actor: req.user._id, action: "meals.updated", summary: `${req.user.name} updated ${entries.length} meal ${entries.length === 1 ? "entry" : "entries"} (${days[0]}${days.length > 1 ? ` – ${days[days.length - 1]}` : ""})` });
    realtime.toHome(req.home._id, "meals:changed", { days });
    res.json({ ok: true, updated: entries.length });
  }
);

// Fill in missing entries from each member's default schedule.
router.post(
  "/meals/generate",
  requirePerm("meals.manage"),
  validate({ body: range }),
  async (req, res) => {
    const days = eachDay(req.v.body.from, req.v.body.to);
    await assertDaysEditable(req.home, days);
    const members = await Membership.find({ home: req.home._id, status: "active", mealsEnabled: { $ne: false } });
    const ops = [];
    for (const d of days) for (const m of members) {
      ops.push({ updateOne: { filter: { home: req.home._id, membership: m._id, day: d }, update: { $setOnInsert: { counts: defaultCountsFor(m, req.home), guests: {}, updatedBy: req.user._id } }, upsert: true } });
    }
    const result = ops.length ? await MealEntry.bulkWrite(ops) : { upsertedCount: 0 };
    await logActivity({ home: req.home, actor: req.user._id, action: "meals.generated", summary: `${req.user.name} filled default meals for ${days.length} day(s)` });
    realtime.toHome(req.home._id, "meals:changed", { days });
    res.json({ created: result.upsertedCount });
  }
);

router.get("/meals/mine", validate({ query: range }), async (req, res) => {
  const { from, to } = req.v.query;
  const entries = await MealEntry.find({ home: req.home._id, membership: req.membership._id, day: { $gte: from, $lte: to } }).sort({ day: -1 });
  res.json({ mealTypes: req.home.settings.mealTypes, entries: entries.map((e) => ({ day: e.day, counts: toObj(e.counts), guests: toObj(e.guests), note: e.note })) });
});

// Live accounting for any range (e.g. the current month before closing).
router.get("/meals/summary", validate({ query: range.or(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })) }), async (req, res) => {
  const r = req.v.query.month ? monthRange(req.v.query.month) : req.v.query;
  const summary = await computePeriod(req.home, { startDay: r.from, endDay: r.to });
  if (!req.can("finance.view_all") && !req.can("meals.manage")) {
    // Members see totals and their own row; others' charges stay private.
    summary.members = summary.members.map((m) => (m.membership === String(req.membership._id) ? m : { ...m, charge: undefined, guestCharge: undefined }));
  }
  res.json({ summary });
});

// ---------- periods ----------
router.get("/meals/periods", async (req, res) => {
  const periods = await MealPeriod.find({ home: req.home._id }).sort({ startDay: -1 }).select("-snapshot.members").populate("closedBy", "name");
  res.json({ periods });
});

const periodInput = z.object({ name: z.string().trim().min(1).max(60), startDay: day, endDay: day }).refine((v) => isValidDay(v.startDay) && isValidDay(v.endDay) && v.startDay <= v.endDay, "End date must be on or after start date");

async function assertNoOverlap(home, { startDay, endDay }, excludeId) {
  const overlap = await MealPeriod.findOne({ home: home._id, _id: { $ne: excludeId }, startDay: { $lte: endDay }, endDay: { $gte: startDay } });
  if (overlap) throw conflict(`Dates overlap with "${overlap.name}"`);
}

router.post("/meals/periods", requirePerm("meals.configure"), validate({ body: periodInput }), async (req, res) => {
  if (diffDays(req.v.body.startDay, req.v.body.endDay) > 92) throw badRequest("A meal period can be at most 3 months long");
  await assertNoOverlap(req.home, req.v.body);
  const period = await MealPeriod.create({ ...req.v.body, home: req.home._id, createdBy: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "meal_period.created", summary: `${req.user.name} created meal period "${period.name}"` });
  res.status(201).json({ period });
});

const findPeriod = async (req) => {
  const p = await MealPeriod.findOne({ _id: req.params.pid, home: req.home._id });
  if (!p) throw notFound("Meal period not found");
  return p;
};
const pidParam = z.object({ pid: objectId }).passthrough();

router.patch("/meals/periods/:pid", requirePerm("meals.configure"), validate({ params: pidParam, body: periodInput }), async (req, res) => {
  const period = await findPeriod(req);
  if (period.status === "closed") throw badRequest("Reopen the period before editing it");
  await assertNoOverlap(req.home, req.v.body, period._id);
  Object.assign(period, req.v.body);
  await period.save();
  res.json({ period });
});

router.delete("/meals/periods/:pid", requirePerm("meals.configure"), validate({ params: pidParam }), async (req, res) => {
  const period = await findPeriod(req);
  if (period.status === "closed") throw badRequest("Closed periods cannot be deleted");
  await period.deleteOne(); // meal entries are day-based and stay untouched
  res.json({ ok: true });
});

router.get("/meals/periods/:pid", validate({ params: pidParam }), async (req, res) => {
  const period = await findPeriod(req);
  await period.populate("closedBy", "name");
  const summary = period.status === "closed" ? period.snapshot : await computePeriod(req.home, period);
  if (!req.can("finance.view_all") && !req.can("meals.manage")) {
    summary.members = summary.members.map((m) => (m.membership === String(req.membership._id) ? m : { ...m, charge: undefined, guestCharge: undefined }));
  }
  res.json({ period: { ...period.toObject(), snapshot: undefined }, summary });
});

// Closing freezes the numbers and posts each member's meal charge.
router.post("/meals/periods/:pid/close", requirePerm("meals.configure"), validate({ params: pidParam }), async (req, res) => {
  const period = await findPeriod(req);
  if (period.status === "closed") throw conflict("This period is already closed");
  const summary = await computePeriod(req.home, period);
  if (summary.unallocated > 0) throw badRequest("There are meal expenses but no meals recorded in this period");
  await withTransaction(async (session) => {
    await postEntries(
      summary.members
        .filter((m) => m.charge > 0)
        .map((m) => ({
          home: req.home._id,
          membership: m.membership,
          type: "meal_charge",
          direction: "debit",
          amount: m.charge,
          day: period.endDay,
          description: `Meals · ${period.name} (${m.meals + m.guestMeals} meals)`,
          recordedBy: req.user._id,
          refKind: "meal_period",
          refId: period._id,
        })),
      session
    );
    period.status = "closed";
    period.closedAt = new Date();
    period.closedBy = req.user._id;
    period.snapshot = summary;
    await period.save({ session });
  });
  const users = (await Membership.find({ _id: { $in: summary.members.map((m) => m.membership) } }).select("user")).map((m) => m.user);
  await notify(users, { type: "meal_period_closed", home: req.home._id, title: `${period.name} meal accounts are closed`, body: `Meal rate: ${(summary.rate / 100).toFixed(2)} ${req.home.currency}`, link: `/h/${req.home._id}/meals/periods/${period._id}`, actor: req.user._id });
  await logActivity({ home: req.home, actor: req.user._id, action: "meal_period.closed", summary: `${req.user.name} closed "${period.name}" at rate ${(summary.rate / 100).toFixed(2)}`, targetKind: "meal_period", targetId: period._id, meta: { totalExpense: summary.totalExpense, chargeableMeals: summary.chargeableMeals } });
  res.json({ period: { ...period.toObject(), snapshot: undefined }, summary });
});

router.post("/meals/periods/:pid/reopen", requireAdmin, validate({ params: pidParam, body: z.object({ reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
  const period = await findPeriod(req);
  if (period.status !== "closed") throw badRequest("Only closed periods can be reopened");
  await withTransaction(async (session) => {
    await reverseByRef("meal_period", period._id, req.user._id, `Period reopened: ${req.v.body.reason}`, session);
    period.status = "open";
    period.snapshot = undefined;
    period.closedAt = undefined;
    period.closedBy = undefined;
    await period.save({ session });
  });
  await logActivity({ home: req.home, actor: req.user._id, action: "meal_period.reopened", summary: `${req.user.name} reopened "${period.name}": ${req.v.body.reason}` });
  res.json({ period });
});

module.exports = router;
module.exports.applyMealOff = applyMealOff;
module.exports.applyGuestMeal = applyGuestMeal;
module.exports.assertDaysEditable = assertDaysEditable;
