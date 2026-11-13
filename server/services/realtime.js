// Thin wrapper around the Socket.IO server so services can emit events
// without depending on the HTTP bootstrap (no-op in tests / serverless).
let io = null;
const online = new Map(); // userId -> open socket count (single-instance presence)

module.exports = {
  setIO: (instance) => (io = instance),
  getIO: () => io,
  toUser: (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload),
  toUsers: (userIds, event, payload) => {
    if (!io || !userIds.length) return;
    io.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
  },
  toHome: (homeId, event, payload) => io?.to(`home:${homeId}`).emit(event, payload),
  joinHome: (userId, homeId) => io?.in(`user:${userId}`).socketsJoin(`home:${homeId}`),
  leaveHome: (userId, homeId) => io?.in(`user:${userId}`).socketsLeave(`home:${homeId}`),
  online,
  isOnline: (userId) => (online.get(String(userId)) || 0) > 0,
};
