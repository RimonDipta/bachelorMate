// Meal accounting.
//   chargeable meals = member meals + guest meals   (weighted by meal type)
//   meal rate        = eligible meal expenses / chargeable meals
// With fixed guest pricing, guests pay the fixed rate and the remaining pool is
// shared by member meals. Charges are allocated with largest-remainder rounding
// so they always sum exactly to the pool.
const { MealEntry } = require("../models/Meal");
const Membership = require("../models/Membership");
const { Expense, MEAL_CATEGORIES } = require("../models/Finance");
const { allocate } = require("../lib/money");

const weightsOf = (home) => Object.fromEntries((home.settings.mealTypes || []).map((t) => [t.key, t.weight]));

const sumWeighted = (map, weights) => {
  let total = 0;
  for (const [k, v] of map instanceof Map ? map.entries() : Object.entries(map || {})) {
    total += (Number(v) || 0) * (weights[k] ?? 1);
  }
  return Math.round(total * 100) / 100;
};

async function computePeriod(home, { startDay, endDay }) {
  const weights = weightsOf(home);
  const [entries, expenses, memberships] = await Promise.all([
    MealEntry.find({ home: home._id, day: { $gte: startDay, $lte: endDay } }),
    Expense.find({
      home: home._id,
      status: "active",
      category: { $in: MEAL_CATEGORIES },
      day: { $gte: startDay, $lte: endDay },
    }).select("amount category"),
    Membership.find({ home: home._id }).populate("user", "name avatarUrl"),
  ]);

  const rows = new Map();
  const rowFor = (id) => {
    const key = String(id);
    if (!rows.has(key)) rows.set(key, { membership: key, meals: 0, guestMeals: 0, counts: {}, guestCounts: {}, charge: 0 });
    return rows.get(key);
  };
  memberships.filter((m) => m.status === "active").forEach((m) => rowFor(m._id));

  for (const e of entries) {
    const r = rowFor(e.membership);
    r.meals += sumWeighted(e.counts, weights);
    r.guestMeals += sumWeighted(e.guests, weights);
    for (const [k, v] of e.counts) r.counts[k] = (r.counts[k] || 0) + v;
    for (const [k, v] of e.guests) r.guestCounts[k] = (r.guestCounts[k] || 0) + v;
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    meals: Math.round(r.meals * 100) / 100,
    guestMeals: Math.round(r.guestMeals * 100) / 100,
  }));
  const totalExpense = expenses.reduce((a, e) => a + e.amount, 0);
  const groceryExpense = expenses.filter((e) => e.category === "groceries").reduce((a, e) => a + e.amount, 0);
  const memberMeals = Math.round(list.reduce((a, r) => a + r.meals, 0) * 100) / 100;
  const guestMeals = Math.round(list.reduce((a, r) => a + r.guestMeals, 0) * 100) / 100;

  const pricing = home.settings.guestMealPricing;
  const fixed = home.settings.guestMealFixedRate || 0;
  let chargeableMeals, rate, unallocated = 0, guestRevenue = 0;

  if (pricing === "fixed") {
    list.forEach((r) => {
      r.guestCharge = Math.round(r.guestMeals * fixed);
      guestRevenue += r.guestCharge;
    });
    const pool = Math.max(totalExpense - guestRevenue, 0);
    chargeableMeals = memberMeals;
    const shares = allocate(pool, list.map((r) => r.meals));
    list.forEach((r, i) => (r.charge = shares[i] + r.guestCharge));
    rate = memberMeals > 0 ? pool / memberMeals : 0;
    if (memberMeals === 0) unallocated = pool;
  } else {
    chargeableMeals = Math.round((memberMeals + guestMeals) * 100) / 100;
    const shares = allocate(totalExpense, list.map((r) => r.meals + r.guestMeals));
    list.forEach((r, i) => (r.charge = shares[i]));
    rate = chargeableMeals > 0 ? totalExpense / chargeableMeals : 0;
    if (chargeableMeals === 0) unallocated = totalExpense;
  }

  const memberInfo = new Map(memberships.map((m) => [String(m._id), m]));
  list.forEach((r) => {
    const m = memberInfo.get(r.membership);
    r.user = m?.user ? { _id: m.user._id, name: m.user.name, avatarUrl: m.user.avatarUrl } : null;
    r.status = m?.status;
  });
  list.sort((a, b) => (a.user?.name || "").localeCompare(b.user?.name || ""));

  return {
    startDay,
    endDay,
    totalExpense,
    groceryExpense,
    otherMealExpense: totalExpense - groceryExpense,
    memberMeals,
    guestMeals,
    chargeableMeals,
    rate: Math.round(rate * 100) / 100, // minor units per meal, display only
    guestPricing: pricing,
    guestFixedRate: fixed,
    guestRevenue,
    unallocated,
    mealTypes: home.settings.mealTypes.map((t) => ({ key: t.key, label: t.label, weight: t.weight })),
    members: list,
  };
}

/** Default counts for a membership: its own defaults, else 1 of every enabled type. */
function defaultCountsFor(membership, home) {
  const types = home.settings.mealTypes.filter((t) => t.enabled);
  const defaults = membership.defaultMeals;
  const out = {};
  for (const t of types) {
    const v = defaults && defaults.has?.(t.key) ? defaults.get(t.key) : defaults?.[t.key];
    out[t.key] = v === undefined ? 1 : v;
  }
  return out;
}

module.exports = { computePeriod, defaultCountsFor, weightsOf, sumWeighted };
