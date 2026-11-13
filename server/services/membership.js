const Membership = require("../models/Membership");
const { todayIn } = require("../lib/dates");
const realtime = require("./realtime");

/**
 * Members with an approved departure whose date has arrived become "left".
 * Runs lazily on home access so no scheduler is required.
 */
async function finalizeDueDepartures(home) {
  const today = todayIn(home.timezone);
  const due = await Membership.find({
    home: home._id,
    status: "active",
    scheduledLeaveDay: { $lte: today },
  });
  for (const m of due) {
    // The owner must transfer ownership first; never auto-remove them.
    if (m.roles.includes("admin")) continue;
    m.status = "left";
    m.leftAt = new Date();
    await m.save();
    realtime.leaveHome(m.user, home._id);
  }
}

const populateMember = (q) => q.populate("user", "name email avatarUrl phone lastSeenAt");

module.exports = { finalizeDueDepartures, populateMember };
