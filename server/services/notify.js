// Centralised notifications: persists in-app notifications, pushes them over
// Socket.IO and sends email for important types when the user allows it.
const { Notification } = require("../models/Misc");
const User = require("../models/User");
const Membership = require("../models/Membership");
const { permissionsFor } = require("../lib/permissions");
const realtime = require("./realtime");
const { sendMail, esc } = require("../lib/mailer");
const env = require("../config/env");

const EMAIL_TYPES = new Set([
  "home_invitation",
  "departure_request",
  "payment_reminder",
  "announcement",
  "role_change",
  "membership_approved",
  "member_removed",
]);

/**
 * notify(userIds, { type, title, body, link, home, actor, email })
 * The actor never notifies themselves.
 */
async function notify(userIds, payload) {
  const ids = [...new Set(userIds.filter(Boolean).map((u) => String(u._id ?? u)))].filter((id) => id !== String(payload.actor || ""));
  if (!ids.length) return;
  const users = await User.find({ _id: { $in: ids } }).select("email name notificationPrefs");
  const docs = [];
  for (const u of users) {
    if (u.notificationPrefs?.muted?.includes(payload.type)) continue;
    docs.push({
      user: u._id,
      home: payload.home,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link,
      actor: payload.actor,
    });
  }
  const created = docs.length ? await Notification.insertMany(docs) : [];
  for (const n of created) realtime.toUser(n.user, "notification:new", n);

  const wantsEmail = payload.email ?? EMAIL_TYPES.has(payload.type);
  if (wantsEmail) {
    for (const u of users) {
      if (u.notificationPrefs?.email === false || u.notificationPrefs?.muted?.includes(payload.type)) continue;
      sendMail({
        to: u.email,
        subject: payload.title,
        body: `Hi ${esc(u.name)},<br/><br/>${esc(payload.body || payload.title).split("\n").join("<br/>")}`,
        cta: payload.link ? { label: "Open BachelorMate", url: `${env.CLIENT_URL}${payload.link}` } : undefined,
      });
    }
  }
}

/** Users of an active home membership that hold any of the given permissions. */
async function usersWithPermission(home, ...perms) {
  const members = await Membership.find({ home: home._id, status: "active" }).select("user roles status");
  return members.filter((m) => perms.some((p) => permissionsFor(m, home).has(p))).map((m) => m.user);
}

async function notifyPermitted(home, perms, payload) {
  const users = await usersWithPermission(home, ...[].concat(perms));
  return notify(users, { home: home._id, ...payload });
}

module.exports = { notify, notifyPermitted, usersWithPermission };
