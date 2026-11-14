// Shows English text that comes from the server (errors, activity log,
// notifications, calendar items) in the chosen language. The table lives in
// shared/serverText.json so the server uses the same Bangla for push and email.
// Unknown text is returned unchanged.
import table from "../../../shared/serverText.json";
import { getLanguage } from "./index";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(list) {
  return list.map(([en, bn]) => {
    const slots = [];
    const source = en.split(/(\{\w+(?::\w+)?\})/).map((part) => {
      const m = /^\{(\w+)(?::(\w+))?\}$/.exec(part);
      if (!m) return escape(part);
      slots.push({ name: m[1], kind: m[2] });
      return "(.+?)";
    });
    return { re: new RegExp(`^${source.join("")}$`, "s"), slots, bn };
  });
}

const PATTERNS = compile(table.patterns);
const CALENDAR = compile(table.calendarPatterns || []);

function fill(p, match) {
  const values = {};
  p.slots.forEach((slot, i) => {
    const v = match[i + 1];
    if (slot.kind === "digits") values[slot.name] = toBnDigits(v);
    else if (slot.kind) values[slot.name] = table.maps[slot.kind]?.[v] ?? v;
    else values[slot.name] = v;
  });
  return p.bn.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? "");
}

function translateWith(text, patterns) {
  if (!text || typeof text !== "string" || getLanguage() !== "bn") return text;
  const exact = table.exact[text];
  if (exact) return exact;
  for (const p of patterns) {
    const m = p.re.exec(text);
    if (m) return fill(p, m);
  }
  return text;
}

/** Server message / activity summary / notification text in the chosen language. */
export const translateServer = (text) => translateWith(text, PATTERNS);
/** Generated calendar item titles ("Meal period starts", "Rahim leaves"). */
export const translateCalendar = (text) => translateWith(text, [...CALENDAR, ...PATTERNS]);
