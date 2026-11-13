// Signed-in community features: contacting a listing's poster, home reviews
// and roommate reviews. Former members can still review homes they lived in.
const express = require("express");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const { Listing, HomeReview, RoommateReview, ROOMMATE_TAGS } = require("../models/Community");
const { Conversation, Message, ConversationRead } = require("../models/Chat");
const { validate, z, objectId, badRequest, notFound, forbidden } = require("../lib/http");
const { requireVerified } = require("../middleware/auth");
const { homeReviewEligibility, livedTogether, eligibleReviews, homeReviewSummary, userReviewSummary } = require("../services/community");
const { notify, notifyPermitted } = require("../services/notify");
const { emitToConversation, messageView } = require("../services/chat");
const { logActivity } = require("../services/activity");
const env = require("../config/env");

const router = express.Router();
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: env.isTest ? 1000 : 20, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "You've contacted a lot of listings — try again later." } });

// ---------- contact a listing's poster ----------
router.post(
  "/listings/:id/contact",
  contactLimiter,
  requireVerified,
  validate({ params: z.object({ id: objectId }), body: z.object({ message: z.string().trim().min(5, "Write a short message").max(1000) }) }),
  async (req, res) => {
    const l = await Listing.findById(req.v.params.id).populate("home", "name status");
    if (!l || l.status !== "open" || l.home?.status !== "active") throw notFound("This listing is no longer available");
    if (String(l.postedBy) === String(req.user._id)) throw badRequest("This is your own listing");
    if (await Membership.exists({ home: l.home._id, user: req.user._id, status: "active" })) throw badRequest("You already live in this home");
    const key = `listing:${l._id}:${req.user._id}`;
    const conv = await Conversation.findOneAndUpdate(
      { directKey: key },
      { $setOnInsert: { kind: "listing", listing: l._id, directKey: key, participants: [l.postedBy, req.user._id] } },
      { upsert: true, new: true }
    );
    const msg = await Message.create({ conversation: conv._id, sender: req.user._id, body: req.v.body.message });
    conv.lastMessageAt = msg.createdAt;
    conv.lastMessage = { body: msg.body.slice(0, 140), sender: req.user._id };
    await conv.save();
    await ConversationRead.findOneAndUpdate({ conversation: conv._id, user: req.user._id }, { lastReadAt: msg.createdAt }, { upsert: true });
    await msg.populate("sender", "name avatarUrl");
    emitToConversation(conv, "chat:message", { conversationId: conv._id, kind: "listing", message: messageView(msg) });
    await notify([l.postedBy], {
      type: "listing_inquiry",
      home: l.home._id,
      title: `${req.user.name} is interested in your seat: ${l.title}`,
      body: req.v.body.message.slice(0, 300),
      link: `/friends/chat/${conv._id}`,
      actor: req.user._id,
      email: true,
    });
    res.status(201).json({ conversationId: conv._id });
  }
);

// ---------- reviews: what can I review? ----------
router.get("/reviews/eligible", async (req, res) => {
  res.json({ ...(await eligibleReviews(req.user._id)), tags: ROOMMATE_TAGS });
});

// ---------- home reviews ----------
const homeParam = z.object({ homeId: objectId });
const score = z.number().int().min(1).max(5).optional();

router.get("/reviews/homes/:homeId", validate({ params: homeParam }), async (req, res) => {
  const home = await Home.findById(req.v.params.homeId).select("name");
  if (!home) throw notFound("Home not found");
  const [summary, items, mine, canReview] = await Promise.all([
    homeReviewSummary(home._id),
    HomeReview.find({ home: home._id }).sort({ createdAt: -1 }).limit(50).populate("user", "name avatarUrl").populate("reply.by", "name"),
    HomeReview.findOne({ home: home._id, user: req.user._id }),
    homeReviewEligibility(req.user._id, home._id),
  ]);
  res.json({ home, summary, items, mine, canReview: Boolean(canReview), minStayDays: env.REVIEW_MIN_STAY_DAYS });
});

router.post(
  "/reviews/homes/:homeId",
  requireVerified,
  validate({
    params: homeParam,
    body: z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().min(10, "Write at least a sentence (10+ characters)").max(2000), scores: z.object({ cleanliness: score, food: score, management: score, value: score }).default({}) }),
  }),
  async (req, res) => {
    const m = await homeReviewEligibility(req.user._id, req.v.params.homeId);
    if (!m) throw forbidden(`You can review a home after living there for at least ${env.REVIEW_MIN_STAY_DAYS} days`);
    const existing = await HomeReview.findOne({ home: m.home, user: req.user._id });
    const review = await HomeReview.findOneAndUpdate(
      { home: m.home, user: req.user._id },
      { ...req.v.body, stayedFrom: m.joinedAt, stayedTo: m.status === "active" ? null : m.leftAt },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (!existing) {
      const home = await Home.findById(m.home);
      await notifyPermitted(home, "home.manage", { type: "review", title: `${req.user.name} rated ${home.name} ${review.rating}★`, body: review.body.slice(0, 200), link: `/h/${home._id}/reviews`, actor: req.user._id, email: false });
      await logActivity({ home, actor: req.user._id, action: "review.home", summary: `${req.user.name} reviewed the home (${review.rating}★)` });
    }
    res.status(existing ? 200 : 201).json({ review });
  }
);

router.delete("/reviews/homes/:homeId", validate({ params: homeParam }), async (req, res) => {
  const r = await HomeReview.findOneAndDelete({ home: req.v.params.homeId, user: req.user._id });
  if (!r) throw notFound("Review not found");
  res.json({ ok: true });
});

// The home's Admin/manager can publicly reply once (and edit the reply).
router.post(
  "/reviews/homes/:homeId/:reviewId/reply",
  validate({ params: homeParam.extend({ reviewId: objectId }), body: z.object({ body: z.string().trim().min(2).max(1000) }) }),
  async (req, res) => {
    const m = await Membership.findOne({ home: req.v.params.homeId, user: req.user._id, status: "active" });
    if (!m || !m.roles.some((r) => r === "admin" || r === "manager")) throw forbidden("Only the home's admin or managers can reply");
    const r = await HomeReview.findOne({ _id: req.v.params.reviewId, home: req.v.params.homeId });
    if (!r) throw notFound("Review not found");
    r.reply = { body: req.v.body.body, by: req.user._id, at: new Date() };
    await r.save();
    await notify([r.user], { type: "review", title: `${req.user.name} replied to your review`, body: req.v.body.body.slice(0, 200), actor: req.user._id, email: false });
    res.json({ review: r });
  }
);

// ---------- roommate reviews ----------
const userParam = z.object({ userId: objectId });

router.get("/users/:userId/reviews", validate({ params: userParam }), async (req, res) => {
  const user = await User.findById(req.v.params.userId);
  if (!user) throw notFound("User not found");
  const [summary, items] = await Promise.all([
    userReviewSummary(user._id),
    RoommateReview.find({ subject: user._id }).sort({ createdAt: -1 }).limit(50).populate("reviewer", "name avatarUrl").populate("home", "name"),
  ]);
  res.json({ user: user.toPublic(), summary, items });
});

router.post(
  "/reviews/users/:userId",
  requireVerified,
  validate({
    params: userParam,
    body: z.object({ homeId: objectId, rating: z.number().int().min(1).max(5), body: z.string().trim().min(10, "Write at least a sentence (10+ characters)").max(1500), tags: z.array(z.enum(ROOMMATE_TAGS)).max(6).default([]) }),
  }),
  async (req, res) => {
    const subject = req.v.params.userId;
    if (String(subject) === String(req.user._id)) throw badRequest("You can't review yourself");
    if (!(await livedTogether(req.user._id, subject, req.v.body.homeId))) {
      throw forbidden(env.REVIEW_MIN_STAY_DAYS > 0 ? `You can review someone after living together for at least ${env.REVIEW_MIN_STAY_DAYS} days` : "You can only review people you lived with");
    }
    const existing = await RoommateReview.findOne({ reviewer: req.user._id, subject, home: req.v.body.homeId });
    const review = await RoommateReview.findOneAndUpdate(
      { reviewer: req.user._id, subject, home: req.v.body.homeId },
      { rating: req.v.body.rating, body: req.v.body.body, tags: [...new Set(req.v.body.tags)] },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (!existing) await notify([subject], { type: "review", title: `${req.user.name} left you a ${review.rating}★ roommate review`, link: `/people/${subject}`, actor: req.user._id, email: false });
    res.status(existing ? 200 : 201).json({ review });
  }
);

router.delete("/reviews/users/:reviewId", validate({ params: z.object({ reviewId: objectId }) }), async (req, res) => {
  const r = await RoommateReview.findOneAndDelete({ _id: req.v.params.reviewId, reviewer: req.user._id });
  if (!r) throw notFound("Review not found");
  res.json({ ok: true });
});

module.exports = router;
