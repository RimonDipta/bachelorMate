// Email providers: request format and failure handling (network is mocked).
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.NODE_ENV = "test";
const env = require("../config/env");
const mailer = require("../lib/mailer");

test("parses sender addresses", () => {
  assert.deepEqual(mailer.parseAddress("BachelorMate <me@gmail.com>"), { name: "BachelorMate", email: "me@gmail.com" });
  assert.deepEqual(mailer.parseAddress('"Rahim Ahmed" <rahim@gmail.com>'), { name: "Rahim Ahmed", email: "rahim@gmail.com" });
  assert.deepEqual(mailer.parseAddress("plain@gmail.com"), { email: "plain@gmail.com" });
});

test("sends through the Brevo API when BREVO_API_KEY is set", async (t) => {
  const saved = { key: env.BREVO_API_KEY, from: env.MAIL_FROM, reply: env.MAIL_REPLY_TO };
  env.BREVO_API_KEY = "xkeysib-test";
  env.MAIL_FROM = "BachelorMate <bachelormate.app@gmail.com>";
  env.MAIL_REPLY_TO = "help@gmail.com";
  const calls = [];
  t.mock.method(global, "fetch", async (url, opts) => {
    calls.push({ url, opts });
    return new Response(JSON.stringify({ messageId: "<abc@smtp-relay.brevo.com>" }), { status: 201 });
  });
  try {
    assert.equal(mailer.provider(), "brevo");
    const r = await mailer.sendMail({ to: "user@example.com", subject: "123456 is your code", body: "Hi", code: "123456" });
    assert.equal(r.ok, true);
    assert.equal(r.id, "<abc@smtp-relay.brevo.com>");
    assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(calls[0].opts.headers["api-key"], "xkeysib-test");
    const body = JSON.parse(calls[0].opts.body);
    assert.deepEqual(body.sender, { name: "BachelorMate", email: "bachelormate.app@gmail.com" });
    assert.deepEqual(body.to, [{ email: "user@example.com" }]);
    assert.deepEqual(body.replyTo, { email: "help@gmail.com" });
    assert.match(body.htmlContent, /123456/);
    assert.match(body.textContent, /123456/);

    // Provider errors are reported, never thrown.
    t.mock.method(global, "fetch", async () => new Response(JSON.stringify({ message: "Sender not verified" }), { status: 400 }));
    const bad = await mailer.sendMail({ to: "user@example.com", subject: "x", body: "y" });
    assert.equal(bad.ok, false);
    assert.match(bad.error, /Sender not verified/);
  } finally {
    Object.assign(env, { BREVO_API_KEY: saved.key, MAIL_FROM: saved.from, MAIL_REPLY_TO: saved.reply });
  }
  assert.equal(mailer.provider(), "test");
});
