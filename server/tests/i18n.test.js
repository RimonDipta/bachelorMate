// The shared English→Bangla table for server text (errors, activity log,
// notifications, emails) and the email/push path that uses it.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
process.env.NODE_ENV = "test";
const table = require("../../shared/serverText.json");
const { translate, languageOf } = require("../lib/i18n");
const { sendMail, outbox } = require("../lib/mailer");

const slots = (s) => [...s.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]).sort();

describe("server text translations", () => {
  it("every pattern uses the same placeholders in both languages and known maps", () => {
    for (const [en, bn] of [...table.patterns, ...(table.calendarPatterns || [])]) {
      assert.deepEqual(slots(bn), slots(en), `placeholders differ: ${en}`);
      for (const m of en.matchAll(/\{\w+:(\w+)\}/g)) {
        if (m[1] !== "digits") assert.ok(table.maps[m[1]], `unknown map "${m[1]}" in: ${en}`);
      }
    }
  });

  it("translates exact messages, templates and digits", () => {
    assert.equal(translate("bn", "Invalid email or password"), "ইমেইল বা পাসওয়ার্ড ভুল");
    assert.equal(translate("bn", "Payment reminder for Green Villa"), "Green Villa-এর জমার রিমাইন্ডার");
    assert.equal(translate("bn", "Your payment of 1250.00 BDT was confirmed"), "আপনার ১২৫০.০০ BDT জমা নিশ্চিত হয়েছে");
    assert.equal(translate("bn", "Your meal-off request was approved"), "আপনার মিল অফ রিকোয়েস্ট অনুমোদিত হয়েছে");
    assert.equal(translate("bn", "Alice added groceries expense \"Bazar\" (500.00 BDT)"), "Alice বাজার খরচ “Bazar” যোগ করেছেন (৫০০.০০ BDT)");
  });

  it("leaves English and unknown text alone", () => {
    assert.equal(translate("en", "Invalid email or password"), "Invalid email or password");
    assert.equal(translate("bn", "Something nobody wrote a translation for"), "Something nobody wrote a translation for");
    assert.equal(languageOf({ appearance: { language: "bn" } }), "bn");
    assert.equal(languageOf({ appearance: {} }), "en");
  });

  it("sends emails in the recipient's language", async () => {
    await sendMail({ to: "bn@example.test", lang: "bn", subject: "Reset your password", body: "Hi Rahim,", cta: { label: "Reset password", url: "http://x/reset" } });
    await sendMail({ to: "en@example.test", subject: "Reset your password", body: "Hi Rahim,", cta: { label: "Reset password", url: "http://x/reset" } });
    const bn = outbox.find((m) => m.to === "bn@example.test");
    const en = outbox.find((m) => m.to === "en@example.test");
    assert.equal(bn.subject, "পাসওয়ার্ড রিসেট করুন");
    assert.match(bn.html, /প্রিয় Rahim,/);
    assert.match(bn.html, /পাসওয়ার্ড রিসেট/);
    assert.match(bn.html, /বাটন কাজ করছে না/);
    assert.equal(en.subject, "Reset your password");
    assert.match(en.html, /Button not working/);
  });
});
