// Push delivery: sends to every device and forgets devices that are gone.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const webpush = require("web-push");
const { startDb, stopDb, registerUser } = require("./helpers");
const env = require("../config/env");

describe("web push delivery", () => {
  let push, PushSubscription, u;
  before(async () => {
    await startDb();
    const keys = webpush.generateVAPIDKeys();
    Object.assign(env, { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:test@example.com" });
    delete require.cache[require.resolve("../services/push")];
    push = require("../services/push");
    PushSubscription = require("../models/PushSubscription");
    u = await registerUser("Phone Owner");
  });
  after(async () => {
    Object.assign(env, { VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: undefined });
    delete require.cache[require.resolve("../services/push")];
    await stopDb();
  });

  it("sends the notification to each device and drops expired ones", async (t) => {
    assert.equal(push.enabled(), true);
    await PushSubscription.create([
      { user: u.user._id, endpoint: "https://push.example.com/live", keys: { p256dh: "a", auth: "b" } },
      { user: u.user._id, endpoint: "https://push.example.com/gone", keys: { p256dh: "a", auth: "b" } },
    ]);
    const sent = [];
    t.mock.method(webpush, "sendNotification", async (sub, body) => {
      sent.push({ endpoint: sub.endpoint, body: JSON.parse(body) });
      if (sub.endpoint.endsWith("/gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      return { statusCode: 201 };
    });
    await push.pushToUsers([u.user._id], { title: "Rent is due", body: "Pay 5,000 by Friday", url: "/finance/me" });
    assert.equal(sent.length, 2);
    assert.equal(sent[0].body.title, "Rent is due");
    const left = await PushSubscription.find({ user: u.user._id });
    assert.deepEqual(left.map((s) => s.endpoint), ["https://push.example.com/live"]);
    assert.ok(left[0].lastSuccessAt);
  });
});
