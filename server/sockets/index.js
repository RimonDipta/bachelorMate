// Socket.IO: authenticated with the same access token as the REST API.
// Each socket joins user:<id> and home:<id> for every ACTIVE membership; the
// server (never the client) decides room membership.
const { Server } = require("socket.io");
const env = require("../config/env");
const User = require("../models/User");
const Membership = require("../models/Membership");
const { Friendship } = require("../models/Chat");
const { authenticateToken } = require("../middleware/auth");
const { accessConversation, emitToConversation } = require("../services/chat");
const realtime = require("../services/realtime");

async function presenceAudience(userId) {
  const [homes, friends] = await Promise.all([
    Membership.find({ user: userId, status: "active" }).distinct("home"),
    Friendship.find({ status: "accepted", $or: [{ requester: userId }, { recipient: userId }] }).select("requester recipient"),
  ]);
  const rooms = homes.map((h) => `home:${h}`);
  friends.forEach((f) => rooms.push(`user:${String(f.requester) === String(userId) ? f.recipient : f.requester}`));
  return rooms;
}

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    maxHttpBufferSize: 1e5,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      socket.user = await authenticateToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = String(socket.user._id);
    socket.join(`user:${userId}`);
    const joinHomes = async () => {
      const homes = await Membership.find({ user: userId, status: "active" }).distinct("home");
      for (const room of socket.rooms) if (room.startsWith("home:")) socket.leave(room);
      homes.forEach((h) => socket.join(`home:${h}`));
    };
    await joinHomes();

    const count = (realtime.online.get(userId) || 0) + 1;
    realtime.online.set(userId, count);
    if (count === 1) {
      const rooms = await presenceAudience(userId);
      if (rooms.length) socket.to(rooms).emit("presence", { userId, online: true });
    }

    socket.on("homes:refresh", () => joinHomes().catch(() => {}));

    // Typing indicators are verified against conversation access each time
    // (cached briefly per socket).
    const allowed = new Map();
    socket.on("chat:typing", async ({ conversationId, typing } = {}) => {
      try {
        if (typeof conversationId !== "string") return;
        let conv = allowed.get(conversationId);
        if (!conv || conv.expires < Date.now()) {
          const c = await accessConversation(userId, conversationId);
          conv = { c, expires: Date.now() + 60000 };
          allowed.set(conversationId, conv);
        }
        emitToConversation(conv.c, "chat:typing", { conversationId, userId, name: socket.user.name, typing: Boolean(typing) }, userId);
      } catch {
        /* ignore unauthorised typing events */
      }
    });

    socket.on("disconnect", async () => {
      const left = (realtime.online.get(userId) || 1) - 1;
      if (left > 0) return realtime.online.set(userId, left);
      realtime.online.delete(userId);
      await User.updateOne({ _id: userId }, { lastSeenAt: new Date() }).catch(() => {});
      const rooms = await presenceAudience(userId).catch(() => []);
      if (rooms.length) io.to(rooms).emit("presence", { userId, online: false, lastSeenAt: new Date() });
    });
  });

  realtime.setIO(io);
  return io;
}

module.exports = { initSockets };
