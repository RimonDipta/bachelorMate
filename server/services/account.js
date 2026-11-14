// "Download my data" and "Delete my account".
const Membership = require("../models/Membership");
const Home = require("../models/Home");
const Session = require("../models/Session");
const PushSubscription = require("../models/PushSubscription");
const Feedback = require("../models/Feedback");
const Invitation = require("../models/Invitation");
const Request = require("../models/Request");
const { LedgerEntry, Expense } = require("../models/Finance");
const { MealEntry } = require("../models/Meal");
const { Notification } = require("../models/Misc");
const { Message, Friendship, ConversationRead } = require("../models/Chat");
const { Listing, HomeReview, RoommateReview } = require("../models/Community");
const { deleteByUrl } = require("./storage");
const { badRequest } = require("../lib/http");

/** Everything stored about one person, as plain JSON. */
async function exportUserData(user) {
  const memberships = await Membership.find({ user: user._id }).populate("home", "name currency status").lean();
  const mids = memberships.map((m) => m._id);
  const [ledger, meals, requests, expenses, messages, homeReviews, reviewsWritten, reviewsAboutMe, friends, listings, notifications, feedback] = await Promise.all([
    LedgerEntry.find({ membership: { $in: mids } }).sort({ createdAt: 1 }).lean(),
    MealEntry.find({ membership: { $in: mids } }).sort({ day: 1 }).lean(),
    Request.find({ user: user._id }).sort({ createdAt: 1 }).lean(),
    Expense.find({ recordedBy: user._id }).select("home title category amount day status createdAt").sort({ day: 1 }).lean(),
    Message.find({ sender: user._id, deletedAt: null }).select("conversation body createdAt editedAt").sort({ createdAt: 1 }).lean(),
    HomeReview.find({ user: user._id }).lean(),
    RoommateReview.find({ reviewer: user._id }).lean(),
    RoommateReview.find({ subject: user._id }).select("-reviewer").lean(),
    Friendship.find({ $or: [{ requester: user._id }, { recipient: user._id }] }).populate("requester recipient", "name").lean(),
    Listing.find({ postedBy: user._id }).lean(),
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(500).lean(),
    Feedback.find({ user: user._id }).select("kind message page createdAt").sort({ createdAt: 1 }).lean(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    note: "Money amounts are in the smallest currency unit (e.g. 450000 = 4,500.00).",
    profile: user.toJSON(),
    homes: memberships.map((m) => ({ home: m.home, roles: m.roles, status: m.status, joinedAt: m.joinedAt, leftAt: m.leftAt, room: m.room, phone: m.phone, emergencyContact: m.emergencyContact })),
    ledger,
    meals,
    requests,
    expensesRecorded: expenses,
    messages,
    reviews: { homeReviewsWritten: homeReviews, roommateReviewsWritten: reviewsWritten, roommateReviewsAboutMe: reviewsAboutMe },
    friends: friends.map((f) => ({ status: f.status, requester: f.requester?.name, recipient: f.recipient?.name, createdAt: f.createdAt })),
    listings,
    notifications,
    feedback,
  };
}

/**
 * Homes that stop the account from being deleted: active homes where the
 * person still lives with others. They need to leave (or hand over Admin) first.
 */
async function deletionBlockers(user) {
  const active = await Membership.find({ user: user._id, status: "active" }).populate("home", "name status");
  const blockers = [];
  for (const m of active) {
    if (!m.home || m.home.status !== "active") continue;
    const others = await Membership.countDocuments({ home: m.home._id, status: "active", user: { $ne: user._id } });
    if (others > 0) blockers.push({ homeId: m.home._id, name: m.home.name, admin: m.roles.includes("admin") });
  }
  return blockers;
}

/**
 * Deletes the account. Personal data is erased; the user record stays as an
 * anonymous "Deleted user" so ledgers, meal counts and expenses in shared homes
 * remain correct for everyone else.
 */
async function deleteAccount(user) {
  const blockers = await deletionBlockers(user);
  if (blockers.length) {
    throw badRequest(`Leave ${blockers.map((b) => b.name).join(", ")} first${blockers.some((b) => b.admin) ? " (hand over Admin to someone else)" : ""}, then delete your account.`, { blockers }, "LEAVE_HOMES_FIRST");
  }
  const now = new Date();

  // Homes where they were the only one left are archived; pending join requests are withdrawn.
  const solo = await Membership.find({ user: user._id, status: "active" });
  for (const m of solo) {
    await Home.updateOne({ _id: m.home, status: "active" }, { $set: { status: "archived" } });
    m.status = "left";
    m.leftAt = now;
    await m.save();
  }
  await Membership.updateMany({ user: user._id, status: "pending" }, { $set: { status: "left", leftAt: now } });
  await Membership.updateMany({ user: user._id }, { $unset: { phone: 1, emergencyContact: 1, note: 1, room: 1 } });

  // Personal content.
  await Promise.all([
    Session.deleteMany({ user: user._id }),
    PushSubscription.deleteMany({ user: user._id }),
    Feedback.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    Friendship.deleteMany({ $or: [{ requester: user._id }, { recipient: user._id }] }),
    ConversationRead.deleteMany({ user: user._id }),
    Invitation.updateMany({ invitee: user._id, status: "active" }, { $set: { status: "declined" } }),
    Message.updateMany({ sender: user._id, deletedAt: null }, { $set: { body: "", deletedAt: now } }),
    HomeReview.deleteMany({ user: user._id }),
    RoommateReview.deleteMany({ $or: [{ reviewer: user._id }, { subject: user._id }] }),
    Listing.updateMany({ postedBy: user._id, status: "open" }, { $set: { status: "closed" } }),
  ]);
  if (user.avatarUrl) await deleteByUrl(user.avatarUrl);

  // Anonymise the user record and end every session.
  user.name = "Deleted user";
  user.email = `deleted-${user._id}@users.invalid`;
  user.passwordHash = undefined;
  user.firebaseUid = undefined;
  user.phone = undefined;
  user.bio = undefined;
  user.avatarUrl = undefined;
  user.discoverable = false;
  user.emailVerified = false;
  user.notificationPrefs = { email: false, muted: [] };
  user.lastActiveHome = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.deletedAt = now;
  await user.save();
}

module.exports = { exportUserData, deleteAccount, deletionBlockers };
