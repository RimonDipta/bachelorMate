const { ActivityLog } = require("../models/Misc");
const realtime = require("./realtime");

/** Records an auditable action. Never throws – logging must not break requests. */
async function logActivity({ home, actor, action, summary, targetKind, targetId, meta }, session) {
  try {
    const [doc] = await ActivityLog.create(
      [{ home: home._id || home, actor, action, summary, targetKind, targetId, meta }],
      session ? { session } : undefined
    );
    realtime.toHome(home._id || home, "activity:new", { _id: doc._id, action, summary });
    return doc;
  } catch (err) {
    console.error("Activity log failed:", err.message);
  }
}

module.exports = { logActivity };
