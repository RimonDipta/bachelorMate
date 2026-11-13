const Home = require("../models/Home");
const Membership = require("../models/Membership");
const { Conversation } = require("../models/Chat");
const { randomCode } = require("../lib/security");
const { conflict, badRequest } = require("../lib/http");
const { notify, notifyPermitted } = require("./notify");
const { logActivity } = require("./activity");
const realtime = require("./realtime");

async function uniqueHomeCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(8);
    if (!(await Home.exists({ code }))) return code;
  }
  throw new Error("Could not generate a unique home code");
}

async function ensureHomeConversation(homeId) {
  return Conversation.findOneAndUpdate(
    { kind: "home", home: homeId },
    { $setOnInsert: { kind: "home", home: homeId } },
    { upsert: true, new: true }
  );
}

/**
 * Adds (or re-adds) a user to a home. Handles duplicates, approval rules,
 * notifications and the activity log in one place.
 */
async function joinHome({ home, user, via, invitedBy, profile = {}, forceActive = false }) {
  if (home.status !== "active") throw badRequest("This home is archived and not accepting members");
  const existing = await Membership.findOne({ home: home._id, user: user._id });
  if (existing?.status === "active") throw conflict("You are already a member of this home");
  if (existing?.status === "pending") throw conflict("Your request to join is already waiting for approval");

  const needsApproval = !forceActive && home.settings.requireApproval;
  const membership = existing || new Membership({ home: home._id, user: user._id });
  Object.assign(membership, {
    roles: ["member"],
    status: needsApproval ? "pending" : "active",
    joinedVia: via,
    invitedBy,
    joinedAt: needsApproval ? undefined : new Date(),
    leftAt: undefined,
    scheduledLeaveDay: undefined,
    rulesAcceptedAt: new Date(),
    room: profile.room,
    phone: profile.phone,
    emergencyContact: profile.emergencyContact,
  });
  await membership.save();

  if (needsApproval) {
    await notifyPermitted(home, "members.manage", {
      type: "join_request",
      title: `${user.name} wants to join ${home.name}`,
      body: "Review the request in Members.",
      link: `/h/${home._id}/members?tab=pending`,
      actor: user._id,
    });
  } else {
    realtime.joinHome(user._id, home._id);
    await notifyPermitted(home, "members.view", {
      type: "invitation_accepted",
      title: `${user.name} joined ${home.name}`,
      link: `/h/${home._id}/members`,
      actor: user._id,
    });
  }
  await logActivity({
    home,
    actor: user._id,
    action: needsApproval ? "member.requested" : "member.joined",
    summary: `${user.name} ${needsApproval ? "requested to join" : "joined"} via ${via}`,
    targetKind: "membership",
    targetId: membership._id,
  });
  return membership;
}

async function activateMembership(home, membership, actor) {
  membership.status = "active";
  membership.joinedAt = new Date();
  await membership.save();
  realtime.joinHome(membership.user, home._id);
  await notify([membership.user], {
    type: "membership_approved",
    home: home._id,
    title: `You're in! Welcome to ${home.name}`,
    body: "Your request to join was approved.",
    link: `/h/${home._id}`,
    actor: actor._id,
  });
}

module.exports = { uniqueHomeCode, ensureHomeConversation, joinHome, activateMembership };
