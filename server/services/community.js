// Eligibility rules and summaries for listings and reviews.
const mongoose = require("mongoose");
const Membership = require("../models/Membership");
const { HomeReview, RoommateReview } = require("../models/Community");
const env = require("../config/env");

const DAY = 86400000;
const stayEnd = (m) => (m.status === "active" ? new Date() : m.leftAt || m.updatedAt || new Date());
const STAYED = ["active", "left", "removed"];

/** Membership that lets this user review the home (lived there long enough), or null. */
async function homeReviewEligibility(userId, homeId) {
  const m = await Membership.findOne({ home: homeId, user: userId, status: { $in: STAYED }, joinedAt: { $ne: null } });
  if (!m) return null;
  const days = (stayEnd(m) - m.joinedAt) / DAY;
  return days >= env.REVIEW_MIN_STAY_DAYS ? m : null;
}

/** Days two memberships of the same home overlapped. */
function overlapDays(a, b) {
  const start = Math.max(a.joinedAt.getTime(), b.joinedAt.getTime());
  const end = Math.min(stayEnd(a).getTime(), stayEnd(b).getTime());
  return (end - start) / DAY;
}

/** Whether `reviewerId` lived with `subjectId` in `homeId` long enough to review them. */
async function livedTogether(reviewerId, subjectId, homeId) {
  const [a, b] = await Promise.all([
    Membership.findOne({ home: homeId, user: reviewerId, status: { $in: STAYED }, joinedAt: { $ne: null } }),
    Membership.findOne({ home: homeId, user: subjectId, status: { $in: STAYED }, joinedAt: { $ne: null } }),
  ]);
  if (!a || !b) return false;
  const days = overlapDays(a, b);
  return env.REVIEW_MIN_STAY_DAYS > 0 ? days >= env.REVIEW_MIN_STAY_DAYS : days >= 0;
}

/** Homes and people this user may review, with what they've already reviewed. */
async function eligibleReviews(userId) {
  const mine = await Membership.find({ user: userId, status: { $in: STAYED }, joinedAt: { $ne: null } }).populate("home", "name type");
  const homes = [];
  const people = [];
  const [homeDone, peopleDone] = await Promise.all([
    HomeReview.find({ user: userId }).select("home"),
    RoommateReview.find({ reviewer: userId }).select("subject home"),
  ]);
  const reviewedHomes = new Set(homeDone.map((r) => String(r.home)));
  const reviewedPeople = new Set(peopleDone.map((r) => `${r.subject}:${r.home}`));
  for (const m of mine) {
    if (!m.home) continue;
    const stayed = (stayEnd(m) - m.joinedAt) / DAY;
    homes.push({ home: m.home, status: m.status, eligible: stayed >= env.REVIEW_MIN_STAY_DAYS, reviewed: reviewedHomes.has(String(m.home._id)), daysStayed: Math.floor(stayed) });
    const others = await Membership.find({ home: m.home._id, user: { $ne: userId }, status: { $in: STAYED }, joinedAt: { $ne: null } }).populate("user", "name avatarUrl");
    for (const o of others) {
      if (!o.user) continue;
      const days = overlapDays(m, o);
      const ok = env.REVIEW_MIN_STAY_DAYS > 0 ? days >= env.REVIEW_MIN_STAY_DAYS : days >= 0;
      if (ok) people.push({ user: o.user.toPublic(), home: { _id: m.home._id, name: m.home.name }, reviewed: reviewedPeople.has(`${o.user._id}:${m.home._id}`), daysTogether: Math.floor(Math.max(0, days)) });
    }
  }
  return { homes, people, minStayDays: env.REVIEW_MIN_STAY_DAYS };
}

async function ratingSummaries(homeIds) {
  const rows = await HomeReview.aggregate([
    { $match: { home: { $in: homeIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
    { $group: { _id: "$home", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), { avg: Math.round(r.avg * 10) / 10, count: r.count }]));
}

async function homeReviewSummary(homeId) {
  const rows = await HomeReview.aggregate([
    { $match: { home: new mongoose.Types.ObjectId(String(homeId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 }, c: { $avg: "$scores.cleanliness" }, f: { $avg: "$scores.food" }, m: { $avg: "$scores.management" }, v: { $avg: "$scores.value" }, r1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }, r2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } }, r3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } }, r4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } }, r5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } } } },
  ]);
  const r = rows[0];
  const round = (x) => (x == null ? null : Math.round(x * 10) / 10);
  if (!r) return { avg: null, count: 0, distribution: [0, 0, 0, 0, 0], scores: {} };
  return { avg: round(r.avg), count: r.count, distribution: [r.r1, r.r2, r.r3, r.r4, r.r5], scores: { cleanliness: round(r.c), food: round(r.f), management: round(r.m), value: round(r.v) } };
}

async function userReviewSummary(userId) {
  const rows = await RoommateReview.aggregate([
    { $match: { subject: new mongoose.Types.ObjectId(String(userId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 }, tags: { $push: "$tags" } } },
  ]);
  const r = rows[0];
  if (!r) return { avg: null, count: 0, topTags: [] };
  const counts = {};
  r.tags.flat().forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  return { avg: Math.round(r.avg * 10) / 10, count: r.count, topTags: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, n]) => ({ tag, n })) };
}

module.exports = { homeReviewEligibility, livedTogether, eligibleReviews, ratingSummaries, homeReviewSummary, userReviewSummary };
