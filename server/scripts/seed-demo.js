/*
 * Demo data seed. Creates a fully populated demo home ("Green Villa Mess")
 * with five demo accounts, meals for the last two weeks, expenses, payments,
 * requests, announcements, grocery items, calendar events and chat.
 *
 *   npm run seed:demo              # uses MONGO_URI from .env
 *   DEMO_PASSWORD=MyPass123 npm run seed:demo
 *
 * Safe to re-run: it only deletes and recreates data belonging to the demo
 * accounts (emails ending in @demo.bachelormate.app) and the homes they own.
 * Nothing else in the database is touched.
 */
const mongoose = require("mongoose");
const User = require("../models/User");
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const Session = require("../models/Session");
const { MealEntry, MealPeriod } = require("../models/Meal");
const { Expense, LedgerEntry } = require("../models/Finance");
const Request = require("../models/Request");
const Invitation = require("../models/Invitation");
const { Conversation, Message, ConversationRead, Friendship, pairKey } = require("../models/Chat");
const { Announcement, GroceryItem, CalendarEvent, ActivityLog, Notification } = require("../models/Misc");
const { Listing, HomeReview, RoommateReview } = require("../models/Community");
const { RecurringExpense } = require("../models/Finance");
const { postEntries, postExpense } = require("../services/ledger");
const { uniqueHomeCode, ensureHomeConversation } = require("../services/homes");
const { todayIn, addDays, monthRange } = require("../lib/dates");

const DOMAIN = "demo.bachelormate.app";
const TZ = "Asia/Dhaka";

const PEOPLE = [
  { key: "admin", name: "Rahim Ahmed", roles: ["admin"], room: "A1", phone: "01700000001" },
  { key: "manager", name: "Karim Hossain", roles: ["manager"], room: "A2", phone: "01700000002" },
  { key: "meal", name: "Sakib Hasan", roles: ["meal_manager"], room: "B1", phone: "01700000003" },
  { key: "member", name: "Tanvir Islam", roles: ["member"], room: "B2", phone: "01700000004" },
  { key: "member2", name: "Nayeem Khan", roles: ["member"], room: "C1", phone: "01700000005" },
];

async function wipeDemo() {
  const users = await User.find({ email: { $regex: `@${DOMAIN.replace(/\./g, "\\.")}$` } }).select("_id");
  const userIds = users.map((u) => u._id);
  const homes = await Home.find({ owner: { $in: userIds } }).select("_id");
  const homeIds = homes.map((h) => h._id);
  const convs = await Conversation.find({ $or: [{ home: { $in: homeIds } }, { participants: { $in: userIds } }] }).select("_id");
  const convIds = convs.map((c) => c._id);
  await Promise.all([
    Message.deleteMany({ conversation: { $in: convIds } }),
    ConversationRead.deleteMany({ conversation: { $in: convIds } }),
    Conversation.deleteMany({ _id: { $in: convIds } }),
    Friendship.deleteMany({ $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }] }),
    Notification.deleteMany({ $or: [{ user: { $in: userIds } }, { home: { $in: homeIds } }] }),
    Session.deleteMany({ user: { $in: userIds } }),
    ...[Membership, Invitation, MealEntry, MealPeriod, Request, LedgerEntry, Expense, Announcement, GroceryItem, CalendarEvent, ActivityLog, Listing, HomeReview, RecurringExpense].map((M) => M.deleteMany({ home: { $in: homeIds } })),
    RoommateReview.deleteMany({ $or: [{ reviewer: { $in: userIds } }, { subject: { $in: userIds } }] }),
  ]);
  // Memberships of demo users in non-demo homes are removed too.
  await Membership.deleteMany({ user: { $in: userIds } });
  await Home.deleteMany({ _id: { $in: homeIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

async function seedDemo({ password = process.env.DEMO_PASSWORD || "Demo@1234" } = {}) {
  await wipeDemo();
  const today = todayIn(TZ);
  const month = monthRange(today.slice(0, 7));

  // ---- users ----
  const users = {};
  for (const p of PEOPLE) {
    const u = new User({ name: p.name, email: `${p.key}@${DOMAIN}`, phone: p.phone, emailVerified: true, provider: "local" });
    await u.setPassword(password);
    await u.save();
    users[p.key] = u;
  }

  // ---- home ----
  const home = await Home.create({
    name: "Green Villa Mess",
    address: "House 12, Road 5, Dhanmondi, Dhaka",
    description: "A friendly bachelor mess for students and young professionals.",
    type: "bachelor_mess",
    currency: "BDT",
    timezone: TZ,
    owner: users.admin._id,
    code: await uniqueHomeCode(),
    onboardingCompleted: true,
    settings: {
      rules: ["Keep the kitchen and common areas clean after use", "Quiet hours after 11 PM", "Inform the meal manager before the meal-off deadline", "Monthly dues must be paid by the 10th"],
      requireApproval: true,
      departureNoticeDays: 15,
      paymentDueDay: 10,
      mealOffCutoff: "22:00",
      mealPolicy: "Meals are cooked twice a day. Breakfast counts as half a meal.",
      guestPolicy: "Guests are welcome for meals with one day's notice.",
      paymentPolicy: "Pay via bKash or cash to the manager.",
    },
  });
  const m = {};
  for (const p of PEOPLE) {
    m[p.key] = await Membership.create({
      home: home._id,
      user: users[p.key]._id,
      roles: p.roles,
      status: "active",
      joinedVia: p.key === "admin" ? "creator" : "code",
      joinedAt: new Date(Date.now() - 60 * 86400000), // long enough to review
      rulesAcceptedAt: new Date(),
      room: p.room,
      phone: p.phone,
      defaultMeals: p.key === "member2" ? { breakfast: 0, lunch: 1, dinner: 1 } : undefined,
    });
  }
  for (const u of Object.values(users)) {
    u.lastActiveHome = home._id;
    await u.save();
  }

  // ---- meals: last 14 days (bounded to this month's period start) ----
  const period = await MealPeriod.create({ home: home._id, name: new Date(`${month.from}T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), startDay: month.from, endDay: month.to, createdBy: users.meal._id });
  const start = addDays(today, -13) < month.from ? month.from : addDays(today, -13);
  const entries = [];
  let i = 0;
  for (let d = start; d <= today; d = addDays(d, 1), i++) {
    for (const p of PEOPLE) {
      const counts = { breakfast: p.key === "member2" ? 0 : 1, lunch: 1, dinner: 1 };
      if (p.key === "member" && i % 5 === 2) counts.lunch = 0; // occasional meal off
      if (p.key === "manager" && i % 7 === 4) Object.assign(counts, { breakfast: 0, lunch: 0, dinner: 0 });
      const guests = p.key === "admin" && i % 6 === 3 ? { dinner: 1 } : {};
      entries.push({ home: home._id, membership: m[p.key]._id, day: d, counts, guests, updatedBy: users.meal._id });
    }
  }
  await MealEntry.insertMany(entries);

  // ---- expenses ----
  const addExpense = async (data, by) => {
    const e = new Expense({ home: home._id, recordedBy: by._id, history: [{ by: by._id, action: "created" }], ...data });
    await postExpense(e, by._id);
    await e.save();
    return e;
  };
  const bazar = [[0, 185000, "meal"], [3, 142050, "meal"], [6, 210000, "manager"], [9, 98000, "meal"], [12, 156500, "meal"]];
  for (const [offset, amount, who] of bazar) {
    const day = addDays(start, offset);
    if (day > today) continue;
    await addExpense({ title: "Weekly bazar", category: "groceries", amount, day, paidBy: m[who]._id, allocation: { mode: "meal_pool", memberships: [] } }, users.meal);
  }
  await addExpense({ title: "Gas cylinder", category: "meal_other", amount: 145000, day: start, paidBy: null, allocation: { mode: "meal_pool", memberships: [] } }, users.meal);
  await addExpense({ title: "House rent", category: "rent", amount: 3000000, day: month.from, paidBy: null, allocation: { mode: "equal", memberships: [] } }, users.manager);
  await addExpense({ title: "Internet (60 Mbps)", category: "internet", amount: 150000, day: month.from, paidBy: m.manager._id, allocation: { mode: "equal", memberships: [] } }, users.manager);
  await addExpense({ title: "Electricity bill", category: "utilities", amount: 287550, day: start, paidBy: null, allocation: { mode: "equal", memberships: [] } }, users.manager);
  await addExpense({ title: "Cleaner", category: "cleaning", amount: 200000, day: start, paidBy: null, allocation: { mode: "selected", memberships: [m.admin._id, m.manager._id, m.meal._id, m.member._id] } }, users.manager);

  // ---- payments ----
  const pay = (key, amount, day, method, status = "posted") => ({
    home: home._id, membership: m[key]._id, type: "payment", direction: "credit", amount, day, method, status,
    description: `Monthly deposit (${method})`, recordedBy: status === "posted" ? users.manager._id : users[key]._id,
    ...(status === "posted" ? { reviewedBy: users.manager._id, reviewedAt: new Date() } : {}),
  });
  await postEntries([
    pay("admin", 900000, month.from, "bkash"),
    pay("manager", 800000, month.from, "cash"),
    pay("meal", 850000, addDays(month.from, 1) > today ? month.from : addDays(month.from, 1), "nagad"),
    pay("member", 500000, start, "bkash"),
    pay("member2", 300000, today, "bkash", "pending"),
  ]);

  // ---- requests ----
  const tomorrow = addDays(today, 1);
  await Request.create([
    { home: home._id, membership: m.member._id, user: users.member._id, type: "meal_off", status: "pending", startDay: addDays(today, 2), endDay: addDays(today, 3), note: "Going home for the weekend" },
    { home: home._id, membership: m.member2._id, user: users.member2._id, type: "guest_meal", status: "pending", startDay: tomorrow, mealTypes: ["dinner"], guestCount: 2, guestName: "Cousins" },
    { home: home._id, membership: m.manager._id, user: users.manager._id, type: "meal_off", status: "approved", startDay: addDays(start, 4), endDay: addDays(start, 4), reviewedBy: users.meal._id, reviewedAt: new Date(), reviewNote: "Noted" },
  ]);

  // ---- announcements, grocery, calendar ----
  await Announcement.create([
    { home: home._id, author: users.admin._id, title: "Welcome to BachelorMate!", body: "We now track meals, bazar and dues here. Check your account under Finance → My account.", pinned: true, acknowledgements: [{ user: users.meal._id, at: new Date() }] },
    { home: home._id, author: users.manager._id, title: "Water supply off on Friday", body: "WASA maintenance from 10 AM to 4 PM. Please store water on Thursday night.", important: true, eventDay: addDays(today, 3) },
  ]);
  await GroceryItem.create([
    { home: home._id, name: "Rice (Miniket)", quantity: 25, unit: "kg", estimatedCost: 180000, assignedTo: m.meal._id, createdBy: users.meal._id, neededBy: tomorrow },
    { home: home._id, name: "Soybean oil", quantity: 5, unit: "L", estimatedCost: 95000, assignedTo: m.member._id, createdBy: users.meal._id },
    { home: home._id, name: "Eggs", quantity: 2, unit: "dozen", estimatedCost: 30000, createdBy: users.meal._id },
    { home: home._id, name: "Onion", quantity: 5, unit: "kg", estimatedCost: 40000, createdBy: users.meal._id, purchased: true, purchasedAt: new Date(), actualCost: 42000 },
  ]);
  await CalendarEvent.create([
    { home: home._id, title: "Monthly house meeting", description: "Review dues and the meal rate.", startDay: addDays(today, 5), time: "21:00", createdBy: users.admin._id },
    { home: home._id, title: "Deep cleaning day", startDay: addDays(today, 9), createdBy: users.manager._id },
  ]);

  // ---- chat ----
  const conv = await ensureHomeConversation(home._id);
  const lines = [
    ["admin", "Assalamu alaikum everyone! Our mess is now on BachelorMate 🎉"],
    ["meal", "Bazar done for this week. Receipt is on the expense 🛒"],
    ["member", "Can we have khichuri on Friday?"],
    ["manager", "Reminder: dues by the 10th please 🙏"],
    ["member2", "Bringing two guests for dinner tomorrow, requested in the app."],
  ];
  let t = Date.now() - lines.length * 3600_000;
  for (const [key, body] of lines) {
    t += 3600_000;
    await Message.create({ conversation: conv._id, sender: users[key]._id, body, createdAt: new Date(t), updatedAt: new Date(t) });
  }
  conv.lastMessageAt = new Date(t);
  conv.lastMessage = { body: lines[lines.length - 1][1], sender: users.member2._id };
  await conv.save();

  // ---- friends + a direct message ----
  await Friendship.create({ requester: users.admin._id, recipient: users.manager._id, pairKey: pairKey(users.admin._id, users.manager._id), status: "accepted", acceptedAt: new Date() });
  await Friendship.create({ requester: users.member._id, recipient: users.admin._id, pairKey: pairKey(users.member._id, users.admin._id), status: "pending" });
  const key = pairKey(users.admin._id, users.manager._id);
  const dm = await Conversation.create({ kind: "direct", directKey: key, participants: [users.admin._id, users.manager._id], lastMessageAt: new Date(), lastMessage: { body: "Let's close the month on the 30th.", sender: users.manager._id } });
  await Message.create({ conversation: dm._id, sender: users.manager._id, body: "Let's close the month on the 30th." });

  // ---- seat listing + reviews ----
  await Listing.create({
    home: home._id, postedBy: users.admin._id, title: "1 seat in a friendly 5-person mess", seats: 1, roomType: "shared_room",
    rent: 450000, deposit: 450000, mealCostEstimate: 300000, availableFrom: addDays(today, 10), gender: "male", occupation: "any",
    city: "Dhaka", area: "Dhanmondi", amenities: ["wifi", "meals", "generator", "gas", "water_filter", "cleaner"],
    description: "Tanvir is moving out at the end of the month. Shared room with one other member, two meals a day, fast Wi-Fi and a cleaner twice a week. 5 minutes walk from Dhanmondi 27. Bills and the meal rate are tracked transparently in BachelorMate.",
  });
  const stayedFrom = new Date(Date.now() - 60 * 86400000);
  await HomeReview.create([
    { home: home._id, user: users.meal._id, rating: 5, body: "Food is genuinely good and the meal rate is always clear — no more arguments at the end of the month.", scores: { cleanliness: 4, food: 5, management: 5, value: 5 }, stayedFrom },
    { home: home._id, user: users.member._id, rating: 4, body: "Friendly people and fair bills. Water pressure on the top floor could be better.", scores: { cleanliness: 4, food: 4, management: 4, value: 4 }, stayedFrom, reply: { body: "Thanks Tanvir! We have asked the landlord about a booster pump.", by: users.admin._id, at: new Date() } },
    { home: home._id, user: users.member2._id, rating: 4, body: "Good location near Dhanmondi 27 and the managers respond quickly to requests.", scores: { cleanliness: 3, food: 4, management: 5, value: 4 }, stayedFrom },
  ]);
  await RoommateReview.create([
    { reviewer: users.member._id, subject: users.admin._id, home: home._id, rating: 5, body: "Runs the mess fairly and always shares the numbers with everyone.", tags: ["respectful", "pays_on_time", "helpful"] },
    { reviewer: users.meal._id, subject: users.member._id, rating: 4, home: home._id, body: "Easy to live with and keeps the room clean. Sometimes late with dues.", tags: ["clean", "friendly", "late_payments"] },
  ]);

  await ActivityLog.create({ home: home._id, actor: users.admin._id, action: "home.created", summary: "Demo data loaded for Green Villa Mess" });
  await Notification.create({ user: users.admin._id, home: home._id, type: "join_request", title: "Welcome to the BachelorMate demo", body: "Explore meals, finance, requests and chat. Every role has its own demo login.", link: `/h/${home._id}` });

  return { home, users, period, password };
}

module.exports = { seedDemo, wipeDemo, DOMAIN, PEOPLE };

if (require.main === module) {
  const env = require("../config/env");
  const { connectDB, disconnectDB } = require("../config/db");
  (async () => {
    await connectDB(env.MONGO_URI);
    const { home, password } = await seedDemo();
    console.log(`\nDemo home "${home.name}" ready (join code ${home.code}). Password for all demo accounts: ${password}\n`);
    for (const p of PEOPLE) console.log(`  ${p.roles.join("/").padEnd(13)} ${p.key}@${DOMAIN}`);
    console.log("");
  })()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => disconnectDB().catch(() => mongoose.disconnect()));
}
