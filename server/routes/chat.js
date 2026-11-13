// Home chat + friend (direct) chat, friendships and notifications.
const express = require("express");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Home = require("../models/Home");
const Membership = require("../models/Membership");
const { Conversation, Message, ConversationRead, Friendship, pairKey } = require("../models/Chat");
const { Notification } = require("../models/Misc");
const { validate, z, objectId, badRequest, notFound, forbidden, conflict } = require("../lib/http");
const { accessConversation, emitToConversation, messageView } = require("../services/chat");
const { ensureHomeConversation } = require("../services/homes");
const { notify } = require("../services/notify");
const realtime = require("../services/realtime");
const env = require("../config/env");

const router = express.Router();
const sendLimiter = rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 1000 : 60, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "You're sending messages too fast" } });

async function unreadFor(convId, userId) {
  const read = await ConversationRead.findOne({ conversation: convId, user: userId });
  return Message.countDocuments({ conversation: convId, sender: { $ne: userId }, deletedAt: null, createdAt: { $gt: read?.lastReadAt || new Date(0) } });
}

// ---------- conversations ----------
router.get("/chat/conversations", async (req, res) => {
  const homeIds = await Membership.find({ user: req.user._id, status: "active" }).distinct("home");
  for (const h of homeIds) await ensureHomeConversation(h);
  const convs = await Conversation.find({ $or: [{ kind: "home", home: { $in: homeIds } }, { kind: "direct", participants: req.user._id }] })
    .populate("home", "name")
    .populate("participants", "name avatarUrl lastSeenAt")
    .sort({ lastMessageAt: -1 });
  const out = [];
  for (const c of convs) {
    if (c.kind === "direct" && !c.lastMessageAt) continue;
    const other = c.kind === "direct" ? c.participants.find((p) => String(p._id) !== String(req.user._id)) : null;
    out.push({
      _id: c._id,
      kind: c.kind,
      home: c.home,
      other: other && { ...other.toPublic(), lastSeenAt: other.lastSeenAt, online: realtime.isOnline(other._id) },
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unread: await unreadFor(c._id, req.user._id),
    });
  }
  res.json({ conversations: out, totalUnread: out.reduce((a, c) => a + c.unread, 0) });
});

router.get("/chat/home/:homeId", validate({ params: z.object({ homeId: objectId }) }), async (req, res) => {
  const ok = await Membership.exists({ home: req.v.params.homeId, user: req.user._id, status: "active" });
  if (!ok) throw notFound("Home not found");
  const conv = await ensureHomeConversation(req.v.params.homeId);
  res.json({ conversation: conv });
});

router.post("/chat/direct", validate({ body: z.object({ userId: objectId }) }), async (req, res) => {
  const other = req.v.body.userId;
  if (String(other) === String(req.user._id)) throw badRequest("You cannot message yourself");
  const f = await Friendship.exists({ pairKey: pairKey(req.user._id, other), status: "accepted" });
  if (!f) throw forbidden("You can only message friends");
  const key = pairKey(req.user._id, other);
  const conv = await Conversation.findOneAndUpdate({ directKey: key }, { $setOnInsert: { kind: "direct", directKey: key, participants: [req.user._id, other] } }, { upsert: true, new: true }).populate("participants", "name avatarUrl lastSeenAt");
  res.json({ conversation: conv });
});

const cidParam = z.object({ cid: objectId });

router.get(
  "/chat/:cid/messages",
  validate({ params: cidParam, query: z.object({ before: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(100).default(40) }) }),
  async (req, res) => {
    const conv = await accessConversation(req.user._id, req.v.params.cid);
    const filter = { conversation: conv._id };
    if (req.v.query.before) filter.createdAt = { $lt: new Date(req.v.query.before) };
    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(req.v.query.limit).populate("sender", "name avatarUrl");
    const reads = await ConversationRead.find({ conversation: conv._id }).select("user lastReadAt");
    let members = [];
    if (conv.kind === "home") {
      members = await Membership.find({ home: conv.home, status: "active" }).populate("user", "name avatarUrl lastSeenAt");
      members = members.map((m) => ({ ...m.user.toPublic(), roles: m.roles, online: realtime.isOnline(m.user._id), lastSeenAt: m.user.lastSeenAt }));
    } else {
      const users = await User.find({ _id: { $in: conv.participants } }).select("name avatarUrl lastSeenAt");
      members = users.map((u) => ({ ...u.toPublic(), online: realtime.isOnline(u._id), lastSeenAt: u.lastSeenAt }));
    }
    const home = conv.kind === "home" ? await Home.findById(conv.home).select("name") : null;
    res.json({ conversation: { _id: conv._id, kind: conv.kind, home }, messages: messages.reverse().map(messageView), reads, members, hasMore: messages.length === req.v.query.limit });
  }
);

router.post("/chat/:cid/messages", sendLimiter, validate({ params: cidParam, body: z.object({ body: z.string().trim().min(1, "Message is empty").max(4000) }) }), async (req, res) => {
  const conv = await accessConversation(req.user._id, req.v.params.cid, { write: true });
  const msg = await Message.create({ conversation: conv._id, sender: req.user._id, body: req.v.body.body });
  conv.lastMessageAt = msg.createdAt;
  conv.lastMessage = { body: msg.body.slice(0, 140), sender: req.user._id };
  await conv.save();
  await ConversationRead.findOneAndUpdate({ conversation: conv._id, user: req.user._id }, { lastReadAt: msg.createdAt }, { upsert: true });
  await msg.populate("sender", "name avatarUrl");
  const payload = { conversationId: conv._id, kind: conv.kind, home: conv.home, message: messageView(msg) };
  emitToConversation(conv, "chat:message", payload);
  if (conv.kind === "direct") {
    const other = conv.participants.find((p) => String(p) !== String(req.user._id));
    if (!realtime.isOnline(other)) {
      await notify([other], { type: "message", title: `New message from ${req.user.name}`, body: msg.body.slice(0, 120), link: `/friends/chat/${conv._id}`, actor: req.user._id, email: false });
    }
  }
  res.status(201).json({ message: messageView(msg) });
});

const midParam = z.object({ mid: objectId });
async function ownMessage(req) {
  const msg = await Message.findById(req.v.params.mid).select("+edits");
  if (!msg) throw notFound("Message not found");
  const conv = await accessConversation(req.user._id, msg.conversation);
  return { msg, conv };
}

router.patch("/chat/messages/:mid", validate({ params: midParam, body: z.object({ body: z.string().trim().min(1).max(4000) }) }), async (req, res) => {
  const { msg, conv } = await ownMessage(req);
  if (String(msg.sender) !== String(req.user._id)) throw forbidden("You can only edit your own messages");
  if (msg.deletedAt) throw badRequest("Deleted messages cannot be edited");
  if (Date.now() - msg.createdAt.getTime() > 24 * 3600 * 1000) throw badRequest("Messages can only be edited within 24 hours");
  msg.edits.push({ body: msg.body, at: new Date() }); // audit trail
  msg.body = req.v.body.body;
  msg.editedAt = new Date();
  await msg.save();
  await msg.populate("sender", "name avatarUrl");
  emitToConversation(conv, "chat:message:updated", { conversationId: conv._id, message: messageView(msg) });
  res.json({ message: messageView(msg) });
});

router.delete("/chat/messages/:mid", validate({ params: midParam }), async (req, res) => {
  const { msg, conv } = await ownMessage(req);
  let allowed = String(msg.sender) === String(req.user._id);
  if (!allowed && conv.kind === "home") {
    // The home Admin can moderate the home chat.
    allowed = Boolean(await Membership.exists({ home: conv.home, user: req.user._id, status: "active", roles: "admin" }));
  }
  if (!allowed) throw forbidden("You can only delete your own messages");
  if (!msg.deletedAt) {
    msg.edits.push({ body: msg.body, at: new Date() });
    msg.deletedAt = new Date();
    await msg.save();
  }
  emitToConversation(conv, "chat:message:updated", { conversationId: conv._id, message: messageView(msg) });
  res.json({ message: messageView(msg) });
});

router.post("/chat/:cid/read", validate({ params: cidParam }), async (req, res) => {
  const conv = await accessConversation(req.user._id, req.v.params.cid);
  const at = new Date();
  await ConversationRead.findOneAndUpdate({ conversation: conv._id, user: req.user._id }, { lastReadAt: at }, { upsert: true });
  emitToConversation(conv, "chat:read", { conversationId: conv._id, userId: req.user._id, at });
  res.json({ ok: true });
});

// ---------- friends ----------
router.get("/friends", async (req, res) => {
  const fs = await Friendship.find({ status: "accepted", $or: [{ requester: req.user._id }, { recipient: req.user._id }] }).populate("requester recipient", "name avatarUrl bio lastSeenAt");
  const friends = fs.map((f) => {
    const other = String(f.requester._id) === String(req.user._id) ? f.recipient : f.requester;
    return { friendshipId: f._id, since: f.acceptedAt, ...other.toPublic(), lastSeenAt: other.lastSeenAt, online: realtime.isOnline(other._id) };
  });
  res.json({ friends: friends.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)) });
});

router.get("/friends/requests", async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    Friendship.find({ recipient: req.user._id, status: "pending" }).populate("requester", "name avatarUrl bio").sort({ createdAt: -1 }),
    Friendship.find({ requester: req.user._id, status: "pending" }).populate("recipient", "name avatarUrl bio").sort({ createdAt: -1 }),
  ]);
  res.json({
    incoming: incoming.map((f) => ({ _id: f._id, user: f.requester.toPublic(), createdAt: f.createdAt })),
    outgoing: outgoing.map((f) => ({ _id: f._id, user: f.recipient.toPublic(), createdAt: f.createdAt })),
  });
});

router.post("/friends/requests", validate({ body: z.object({ userId: objectId }) }), async (req, res) => {
  const otherId = req.v.body.userId;
  if (String(otherId) === String(req.user._id)) throw badRequest("You cannot befriend yourself");
  const other = await User.findById(otherId);
  if (!other) throw notFound("User not found");
  const key = pairKey(req.user._id, otherId);
  const existing = await Friendship.findOne({ pairKey: key });
  if (existing?.status === "accepted") throw conflict("You are already friends");
  if (existing && String(existing.requester) === String(req.user._id)) throw conflict("Friend request already sent");
  if (existing) {
    // They already asked us – accept instead of creating a duplicate.
    existing.status = "accepted";
    existing.acceptedAt = new Date();
    await existing.save();
    await notify([otherId], { type: "friend_accepted", title: `${req.user.name} accepted your friend request`, link: `/friends`, actor: req.user._id });
    return res.json({ friendship: existing });
  }
  const f = await Friendship.create({ requester: req.user._id, recipient: otherId, pairKey: key });
  await notify([otherId], { type: "friend_request", title: `${req.user.name} sent you a friend request`, link: `/friends?tab=requests`, actor: req.user._id });
  res.status(201).json({ friendship: f });
});

const fidParam = z.object({ fid: objectId });
router.post("/friends/requests/:fid/accept", validate({ params: fidParam }), async (req, res) => {
  const f = await Friendship.findOne({ _id: req.v.params.fid, recipient: req.user._id, status: "pending" });
  if (!f) throw notFound("Friend request not found");
  f.status = "accepted";
  f.acceptedAt = new Date();
  await f.save();
  await notify([f.requester], { type: "friend_accepted", title: `${req.user.name} accepted your friend request`, link: `/friends`, actor: req.user._id });
  res.json({ friendship: f });
});

// Reject (recipient) or cancel (requester).
router.post("/friends/requests/:fid/decline", validate({ params: fidParam }), async (req, res) => {
  const f = await Friendship.findOne({ _id: req.v.params.fid, status: "pending", $or: [{ recipient: req.user._id }, { requester: req.user._id }] });
  if (!f) throw notFound("Friend request not found");
  await f.deleteOne();
  res.json({ ok: true });
});

router.delete("/friends/:userId", validate({ params: z.object({ userId: objectId }) }), async (req, res) => {
  const f = await Friendship.findOneAndDelete({ pairKey: pairKey(req.user._id, req.v.params.userId), status: "accepted" });
  if (!f) throw notFound("Friend not found");
  res.json({ ok: true });
});

// ---------- notifications ----------
router.get("/notifications", validate({ query: z.object({ unread: z.enum(["1", "0"]).optional(), before: z.string().datetime().optional() }) }), async (req, res) => {
  const filter = { user: req.user._id };
  if (req.v.query.unread === "1") filter.readAt = null;
  if (req.v.query.before) filter.createdAt = { $lt: new Date(req.v.query.before) };
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(30).populate("actor", "name avatarUrl").populate("home", "name");
  const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({ items, unread, hasMore: items.length === 30 });
});

router.get("/notifications/unread-count", async (req, res) => {
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) });
});

router.post("/notifications/read-all", async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
});

router.post("/notifications/:nid/read", validate({ params: z.object({ nid: objectId }) }), async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.v.params.nid, user: req.user._id }, { readAt: new Date() }, { new: true });
  if (!n) throw notFound("Notification not found");
  res.json({ notification: n });
});

module.exports = router;
