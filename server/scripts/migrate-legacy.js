/*
 * One-way, NON-DESTRUCTIVE migration from the original "family" data model
 * (collections: families, memberships, meals, guestmeals, payments, expenses)
 * into the new home-based collections. Legacy collections are only read.
 *
 *   node scripts/migrate-legacy.js            # dry run – prints what would happen
 *   node scripts/migrate-legacy.js --apply    # writes the new documents
 *
 * Re-running is safe: families already migrated (homes.migratedFrom) are skipped.
 */
const mongoose = require("mongoose");
const env = require("../config/env");
const { connectDB, disconnectDB } = require("../config/db");
const { randomCode } = require("../lib/security");
const { todayIn } = require("../lib/dates");
const { DEFAULT_MEAL_TYPES } = require("../models/Home");

const APPLY = process.argv.includes("--apply");
const TZ = "Asia/Dhaka";
const toMinor = (n) => Math.round(Number(n || 0) * 100);
const dayOf = (d) => todayIn(TZ, new Date(d || Date.now()));

async function main() {
  await connectDB(env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const has = async (n) => (await db.listCollections({ name: n }).toArray()).length > 0;
  if (!(await has("families"))) {
    console.log("No legacy 'families' collection found – nothing to migrate.");
    return;
  }

  const families = await col("families").find().toArray();
  const stats = { homes: 0, skipped: 0, memberships: 0, meals: 0, payments: 0, expenses: 0 };

  for (const fam of families) {
    if (await col("homes").findOne({ migratedFrom: fam._id })) {
      stats.skipped++;
      continue;
    }
    const homeId = new mongoose.Types.ObjectId();
    const now = new Date();
    const home = {
      _id: homeId,
      name: fam.name,
      type: "bachelor_mess",
      currency: "BDT",
      timezone: TZ,
      owner: fam.createdBy,
      code: fam.familyCode && !(await col("homes").findOne({ code: String(fam.familyCode) })) ? String(fam.familyCode) : randomCode(8),
      status: "active",
      onboardingCompleted: true,
      settings: { rules: [], requireApproval: true, codeJoinEnabled: true, departureNoticeDays: 15, paymentDueDay: 10, mealTypes: DEFAULT_MEAL_TYPES.map((t) => ({ ...t, weight: 1 })), mealOffCutoff: "22:00", guestMealPricing: "meal_rate", guestMealFixedRate: 0, rolePermissions: {} },
      migratedFrom: fam._id,
      createdAt: fam.createdAt || now,
      updatedAt: now,
    };
    const legacyMembers = await col("memberships").find({ family: fam._id }).toArray();
    const memberMap = new Map();
    const memberships = legacyMembers.map((m) => {
      const id = new mongoose.Types.ObjectId();
      memberMap.set(String(m._id), id);
      const roles = m.roles?.includes("admin") ? ["admin"] : m.roles?.includes("manager") ? ["manager"] : ["member"];
      return {
        _id: id,
        home: homeId,
        user: m.user,
        roles,
        status: { approved: "active", pending: "pending", kicked: "removed" }[m.status] || "pending",
        joinedVia: String(m.user) === String(fam.createdBy) ? "creator" : "code",
        joinedAt: m.joinDate,
        leftAt: m.leaveDate,
        migratedFrom: m._id,
        createdAt: m.createdAt || now,
        updatedAt: now,
      };
    });
    if (!memberships.some((m) => m.roles.includes("admin"))) {
      const creator = memberships.find((m) => String(m.user) === String(fam.createdBy));
      if (creator) creator.roles = ["admin"];
    }

    // Meals + guest meals merged into one entry per member per day.
    const entries = new Map();
    const entryFor = (mid, d) => {
      const k = `${mid}|${d}`;
      if (!entries.has(k)) entries.set(k, { _id: new mongoose.Types.ObjectId(), home: homeId, membership: mid, day: d, counts: {}, guests: {}, createdAt: now, updatedAt: now });
      return entries.get(k);
    };
    for (const m of await col("meals").find({ family: fam._id }).toArray()) {
      const mid = memberMap.get(String(m.membership));
      if (!mid) continue;
      const e = entryFor(mid, dayOf(m.date));
      e.counts = { breakfast: m.breakfast ? 1 : 0, lunch: m.lunch ? 1 : 0, dinner: m.dinner ? 1 : 0 };
    }
    if (await has("guestmeals")) {
      for (const g of await col("guestmeals").find({ family: fam._id }).toArray()) {
        const mid = memberMap.get(String(g.membership));
        if (!mid) continue;
        entryFor(mid, dayOf(g.date)).guests = { breakfast: g.breakfastGuests || 0, lunch: g.lunchGuests || 0, dinner: g.dinnerGuests || 0 };
      }
    }

    const ledger = [];
    for (const p of await col("payments").find({ family: fam._id, status: { $in: ["approved", "pending"] } }).toArray()) {
      const mid = memberMap.get(String(p.membership));
      if (!mid || toMinor(p.amount) <= 0) continue;
      ledger.push({ home: homeId, membership: mid, type: "payment", direction: "credit", amount: toMinor(p.amount), day: dayOf(p.paidAt), method: p.method === "other" ? "other" : p.method, description: p.description || "Payment (migrated)", status: p.status === "approved" ? "posted" : "pending", recordedBy: p.createdBy, createdAt: p.createdAt || now, updatedAt: now });
    }
    const expenses = [];
    for (const x of await col("expenses").find({ family: fam._id }).toArray()) {
      if (toMinor(x.amount) <= 0) continue;
      const paidBy = memberMap.get(String(x.membership)) || null;
      const category = x.category === "meal" ? "groceries" : x.category === "utility" ? "utilities" : "other";
      const id = new mongoose.Types.ObjectId();
      expenses.push({ _id: id, home: homeId, title: x.description || category, category, amount: toMinor(x.amount), day: dayOf(x.date), paidBy, allocation: { mode: category === "groceries" ? "meal_pool" : "none", memberships: [] }, status: "active", recordedBy: x.createdBy, history: [{ at: now, action: "migrated" }], createdAt: x.createdAt || now, updatedAt: now });
      if (paidBy) ledger.push({ home: homeId, membership: paidBy, type: "reimbursement", direction: "credit", amount: toMinor(x.amount), day: dayOf(x.date), description: `Paid for: ${x.description || category} (migrated)`, status: "posted", recordedBy: x.createdBy, refKind: "expense", refId: id, createdAt: now, updatedAt: now });
    }

    console.log(`• ${fam.name}: ${memberships.length} members, ${entries.size} meal days, ${ledger.length} ledger entries, ${expenses.length} expenses`);
    stats.homes++;
    stats.memberships += memberships.length;
    stats.meals += entries.size;
    stats.payments += ledger.length;
    stats.expenses += expenses.length;

    if (APPLY) {
      await col("homes").insertOne(home);
      if (memberships.length) await col("home_memberships").insertMany(memberships);
      if (entries.size) await col("meal_entries").insertMany([...entries.values()]);
      if (expenses.length) await col("home_expenses").insertMany(expenses);
      if (ledger.length) await col("ledger_entries").insertMany(ledger);
    }
  }
  console.log(`\n${APPLY ? "Migrated" : "Would migrate"}:`, stats);
  if (!APPLY) console.log("Dry run only. Re-run with --apply to write. Legacy collections are never modified.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
