// Keeps a home's meal book running without anyone remembering to:
//  - open a meal period for the current month (so the meal rate always has a home), and
//  - fill today's meals from each member's defaults (everyone eats unless they took a meal-off).
// Runs when a home is opened (throttled) and from the hourly sweep, because the
// free hosting plan sleeps and timers alone would miss days. Both are home settings
// (autoMealPeriods, autoFillMeals), on by default. Nothing here overwrites a
// meal entry someone already has, so approved meal-offs and manual edits stay.
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const { MealEntry, MealPeriod } = require("../models/Meal");
const { todayIn, addDays, monthRange } = require("../lib/dates");
const { defaultCountsFor } = require("./meals");
const realtime = require("./realtime");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-11" → "November 2026" (stored in English; the app shows it in the viewer's language). */
const monthName = (month) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const enabled = (home, key) => home.status === "active" && home.settings?.[key] !== false;

/**
 * Opens a period for the current month when no period covers today. It fills the gap
 * around any periods the home already made by hand, so periods never overlap.
 * Returns the created period, or null.
 */
async function ensureCurrentPeriod(home) {
  if (!enabled(home, "autoMealPeriods")) return null;
  const today = todayIn(home.timezone);
  const month = today.slice(0, 7);
  const { from, to } = monthRange(month);
  const overlapping = await MealPeriod.find({ home: home._id, startDay: { $lte: to }, endDay: { $gte: from } }).select("startDay endDay");
  if (overlapping.some((p) => p.startDay <= today && p.endDay >= today)) return null;
  let startDay = from;
  let endDay = to;
  for (const p of overlapping) {
    if (p.endDay < today && p.endDay >= startDay) startDay = addDays(p.endDay, 1);
    if (p.startDay > today && p.startDay <= endDay) endDay = addDays(p.startDay, -1);
  }
  try {
    return await MealPeriod.create({ home: home._id, name: monthName(month), startDay, endDay });
  } catch (err) {
    if (err?.code === 11000) return null; // created by a parallel request
    throw err;
  }
}

/** Creates today's missing meal entries from each member's defaults. Returns how many were created. */
async function fillTodaysMeals(home) {
  if (!enabled(home, "autoFillMeals")) return 0;
  const today = todayIn(home.timezone);
  const closed = await MealPeriod.exists({ home: home._id, status: "closed", startDay: { $lte: today }, endDay: { $gte: today } });
  if (closed) return 0;
  const members = await Membership.find({ home: home._id, status: "active", mealsEnabled: { $ne: false } }).select("defaultMeals mealsEnabled joinedAt");
  if (!members.length) return 0;
  const ops = members.map((m) => ({
    updateOne: {
      filter: { home: home._id, membership: m._id, day: today },
      update: { $setOnInsert: { counts: defaultCountsFor(m, home), guests: {} } },
      upsert: true,
    },
  }));
  const result = await MealEntry.bulkWrite(ops, { ordered: false });
  const created = result.upsertedCount || 0;
  if (created) realtime.toHome(home._id, "meals:changed", { days: [today] });
  return created;
}

const lastRun = new Map();
/** Both jobs for one home, at most every 10 minutes per home unless forced. Never throws. */
async function maintainMeals(home, { force = false } = {}) {
  const key = String(home._id);
  if (!force && Date.now() - (lastRun.get(key) || 0) < 10 * 60 * 1000) return { period: null, filled: 0 };
  lastRun.set(key, Date.now());
  try {
    const period = await ensureCurrentPeriod(home);
    const filled = await fillTodaysMeals(home);
    return { period, filled };
  } catch (err) {
    console.error("Meal automation failed:", err.message);
    return { period: null, filled: 0 };
  }
}

/** The hourly sweep: every active home. */
async function maintainAllHomes() {
  const homes = await Home.find({ status: "active" }).select("status timezone settings");
  for (const home of homes) await maintainMeals(home, { force: true });
  return homes.length;
}

module.exports = { ensureCurrentPeriod, fillTodaysMeals, maintainMeals, maintainAllHomes, monthName };
