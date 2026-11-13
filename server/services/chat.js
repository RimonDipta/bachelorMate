const { Conversation, Friendship, pairKey } = require("../models/Chat");
const Membership = require("../models/Membership");
const Home = require("../models/Home");
const { notFound, forbidden } = require("../lib/http");
const realtime = require("./realtime");

/**
 * Loads a conversation and verifies the user may read it (and optionally
 * write). Home chats require ACTIVE membership, so people who left lose
 * access immediately; direct chats require being a participant (and still
 * friends to send).
 */
async function accessConversation(userId, conversationId, { write = false } = {}) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw notFound("Conversation not found");
  if (conv.kind === "home") {
    const m = await Membership.exists({ home: conv.home, user: userId, status: "active" });
    if (!m) throw notFound("Conversation not found");
    if (write) {
      const home = await Home.findById(conv.home).select("status");
      if (home?.status !== "active") throw forbidden("This home is archived");
    }
  } else {
    if (!conv.participants.some((p) => String(p) === String(userId))) throw notFound("Conversation not found");
    if (write) {
      const other = conv.participants.find((p) => String(p) !== String(userId));
      const f = await Friendship.exists({ pairKey: pairKey(userId, other), status: "accepted" });
      if (!f) throw forbidden("You can only message friends");
    }
  }
  return conv;
}

function emitToConversation(conv, event, payload, exceptUserId) {
  const io = realtime.getIO();
  if (!io) return;
  if (conv.kind === "home") {
    const target = io.to(`home:${conv.home}`);
    (exceptUserId ? target.except(`user:${exceptUserId}`) : target).emit(event, payload);
  } else {
    const rooms = conv.participants.filter((p) => String(p) !== String(exceptUserId || "")).map((p) => `user:${p}`);
    if (rooms.length) io.to(rooms).emit(event, payload);
  }
}

const messageView = (m) => {
  const o = m.toObject ? m.toObject() : m;
  delete o.edits;
  if (o.deletedAt) o.body = "";
  return o;
};

module.exports = { accessConversation, emitToConversation, messageView };
