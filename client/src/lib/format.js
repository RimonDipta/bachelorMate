import { formatNumber, getLanguage, labelMap, localeTag, translate } from "../i18n";
import { translateServer } from "../i18n/serverText";

const moneyFormatters = new Map();

/** Format integer minor units as currency, e.g. 120050 → ৳1,200.50 */
export function money(minor, currency = "BDT", { sign = false, compact = false } = {}) {
  const key = `${getLanguage()}|${currency}|${compact}`;
  if (!moneyFormatters.has(key)) {
    try {
      moneyFormatters.set(
        key,
        new Intl.NumberFormat(localeTag(), {
          style: "currency",
          currency,
          currencyDisplay: "narrowSymbol",
          notation: compact ? "compact" : "standard",
          maximumFractionDigits: compact ? 1 : 2,
          minimumFractionDigits: compact ? 0 : 2,
        })
      );
    } catch {
      moneyFormatters.set(key, new Intl.NumberFormat(localeTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }
  const value = (minor || 0) / 100;
  const s = moneyFormatters.get(key).format(Math.abs(value));
  if (value < 0) return `−${s}`;
  return sign && value > 0 ? `+${s}` : s;
}

/** A plain count in the active locale (Bangla digits in bn). */
export const num = (n) => (typeof n === "number" ? formatNumber(n) : n);

export const toMajorString = (minor) => (minor ? (minor / 100).toFixed(2) : "");

const pad = (n) => String(n).padStart(2, "0");
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (day, n) => {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
};
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const shiftMonth = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};
export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
};
export const monthBounds = (key) => {
  const [y, m] = key.split("-").map(Number);
  return { from: `${key}-01`, to: `${key}-${pad(new Date(y, m, 0).getDate())}` };
};

export const fmtDay = (day, opts = { month: "short", day: "numeric" }) => (day ? parseDay(day).toLocaleDateString(localeTag(), opts) : "");
export const fmtDayLong = (day) => fmtDay(day, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const fmtDate = (iso, opts = { month: "short", day: "numeric", year: "numeric" }) => (iso ? new Date(iso).toLocaleDateString(localeTag(), opts) : "");
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString(localeTag(), { hour: "numeric", minute: "2-digit" });

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return translate("time.justNow");
  const m = Math.round(s / 60);
  if (m < 60) return translate("time.minutesAgo", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return translate("time.hoursAgo", { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return translate("time.daysAgo", { n: d });
  return fmtDate(iso, { month: "short", day: "numeric" });
}

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export const ROLE_LABEL = labelMap("roles", ["admin", "manager", "meal_manager", "member"]);
export const rolesLabel = (roles = []) => roles.map((r) => ROLE_LABEL[r] || r).join(" · ");

export const CATEGORY_LABEL = labelMap("categories", ["groceries", "meal_other", "utilities", "rent", "internet", "cleaning", "maintenance", "other"]);
export const MEAL_CATEGORIES = ["groceries", "meal_other"];

export const ENTRY_LABEL = labelMap("entries", ["opening_balance", "payment", "reimbursement", "expense_share", "meal_charge", "adjustment", "reversal"]);

export const HOME_TYPES = labelMap("homeTypes", ["bachelor_mess", "shared_apartment", "hostel", "family", "other"]);

export const CURRENCIES = ["BDT", "INR", "PKR", "NPR", "LKR", "USD", "EUR", "GBP", "AED", "SAR", "MYR", "SGD", "CAD", "AUD"];

export const mealTotal = (counts = {}, types = []) =>
  types.reduce((a, t) => a + (Number(counts[t.key]) || 0) * (t.weight ?? 1), 0);

export const pluralize = (n, word, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

// Homes start with these meal types; a label the admin hasn't renamed is shown in the chosen language.
const DEFAULT_MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
export const mealTypeLabel = (t) => (t && DEFAULT_MEAL_LABELS[t.key] === t.label ? translate(`mealTypes.${t.key}`) : t?.label);

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Meal period names made automatically are "November 2026"; show those as a month in the chosen language. */
export const periodName = (name) => {
  const m = /^([A-Z][a-z]+) (\d{4})$/.exec(name || "");
  const i = m ? EN_MONTHS.indexOf(m[1]) : -1;
  return i >= 0 ? monthLabel(`${m[2]}-${String(i + 1).padStart(2, "0")}`) : translateServer(name);
};
