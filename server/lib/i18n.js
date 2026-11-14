// Translates the English text the server sends (notification titles, emails)
// into a user's chosen language, so push notifications and emails arrive in
// Bangla for people who picked it. The table is shared with the client
// (shared/serverText.json); text it doesn't know is sent unchanged.
const path = require("path");

let table = { exact: {}, patterns: [], maps: {} };
try {
  table = require(path.join(__dirname, "..", "..", "shared", "serverText.json"));
} catch {
  // Deployed without the shared folder: everything stays English.
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS = (table.patterns || []).map(([en, bn]) => {
  const slots = [];
  const source = en.split(/(\{\w+(?::\w+)?\})/).map((part) => {
    const m = /^\{(\w+)(?::(\w+))?\}$/.exec(part);
    if (!m) return escape(part);
    slots.push({ name: m[1], kind: m[2] });
    return "(.+?)";
  });
  return { re: new RegExp(`^${source.join("")}$`, "s"), slots, bn };
});

/** translate("bn", "Payment reminder for Green Villa") → Bangla; other languages pass through. */
function translate(lang, text) {
  if (lang !== "bn" || !text || typeof text !== "string") return text;
  if (table.exact[text]) return table.exact[text];
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    const values = {};
    p.slots.forEach((slot, i) => {
      const v = m[i + 1];
      values[slot.name] = slot.kind === "digits" ? toBnDigits(v) : slot.kind ? table.maps[slot.kind]?.[v] ?? v : v;
    });
    return p.bn.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? "");
  }
  return text;
}

const languageOf = (user) => (user?.appearance?.language === "bn" ? "bn" : "en");

module.exports = { translate, languageOf };
