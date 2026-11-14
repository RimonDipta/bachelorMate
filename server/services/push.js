// Web push notifications to installed apps and browsers (free; no third party).
// Needs VAPID keys: run `npx web-push generate-vapid-keys` once and set
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Without them push is simply off.
const webpush = require("web-push");
const env = require("../config/env");
const PushSubscription = require("../models/PushSubscription");
const { parseAddress } = require("../lib/mailer");
const { reportError } = require("../lib/monitoring");

let ready = false;
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  try {
    const subject = env.VAPID_SUBJECT || `mailto:${parseAddress(env.MAIL_FROM).email}`;
    webpush.setVapidDetails(subject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    ready = true;
  } catch (err) {
    console.warn(`Push notifications disabled: ${err.message}`);
  }
}

const enabled = () => ready;
const publicKey = () => (ready ? env.VAPID_PUBLIC_KEY : null);

/** Sends { title, body, url, tag } to every device of the given users. Never throws. */
async function pushToUsers(userIds, payload) {
  if (!ready || !userIds.length) return;
  const subs = await PushSubscription.find({ user: { $in: userIds } });
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 6 * 3600, urgency: "normal" });
        await PushSubscription.updateOne({ _id: s._id }, { $set: { lastSuccessAt: new Date() } });
      } catch (err) {
        // 404/410: the device unsubscribed or the app was removed — forget it.
        if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
        else reportError(err, { source: "web-push", status: err.statusCode });
      }
    })
  );
}

module.exports = { enabled, publicKey, pushToUsers };
