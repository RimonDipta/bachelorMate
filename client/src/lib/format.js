const moneyFormatters = new Map();

/** Format integer minor units as currency, e.g. 120050 → ৳1,200.50 */
export function money(minor, currency = "BDT", { sign = false, compact = false } = {}) {
  const key = `${currency}|${compact}`;
  if (!moneyFormatters.has(key)) {
    try {
      moneyFormatters.set(
        key,
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          currencyDisplay: "narrowSymbol",
          notation: compact ? "compact" : "standard",
          maximumFractionDigits: compact ? 1 : 2,
          minimumFractionDigits: compact ? 0 : 2,
        })
      );
    } catch {
      moneyFormatters.set(key, new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }
  const value = (minor || 0) / 100;
  const s = moneyFormatters.get(key).format(Math.abs(value));
  if (value < 0) return `−${s}`;
  return sign && value > 0 ? `+${s}` : s;
}

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
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
export const monthBounds = (key) => {
  const [y, m] = key.split("-").map(Number);
  return { from: `${key}-01`, to: `${key}-${pad(new Date(y, m, 0).getDate())}` };
};

export const fmtDay = (day, opts = { month: "short", day: "numeric" }) => (day ? parseDay(day).toLocaleDateString(undefined, opts) : "");
export const fmtDayLong = (day) => fmtDay(day, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const fmtDate = (iso, opts = { month: "short", day: "numeric", year: "numeric" }) => (iso ? new Date(iso).toLocaleDateString(undefined, opts) : "");
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDate(iso, { month: "short", day: "numeric" });
}

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export const ROLE_LABEL = { admin: "Admin", manager: "Manager", meal_manager: "Meal manager", member: "Member" };
export const rolesLabel = (roles = []) => roles.map((r) => ROLE_LABEL[r] || r).join(" · ");

export const CATEGORY_LABEL = {
  groceries: "Groceries",
  meal_other: "Other meal costs",
  utilities: "Utilities",
  rent: "Rent",
  internet: "Internet",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  other: "Other",
};
export const MEAL_CATEGORIES = ["groceries", "meal_other"];

export const ENTRY_LABEL = {
  opening_balance: "Opening balance",
  payment: "Payment",
  reimbursement: "Reimbursement",
  expense_share: "Expense share",
  meal_charge: "Meal charge",
  adjustment: "Adjustment",
  reversal: "Reversal",
};

export const HOME_TYPES = {
  bachelor_mess: "Bachelor mess",
  shared_apartment: "Shared apartment",
  hostel: "Hostel",
  family: "Family home",
  other: "Other",
};

export const CURRENCIES = ["BDT", "INR", "PKR", "NPR", "LKR", "USD", "EUR", "GBP", "AED", "SAR", "MYR", "SGD", "CAD", "AUD"];

export const mealTotal = (counts = {}, types = []) =>
  types.reduce((a, t) => a + (Number(counts[t.key]) || 0) * (t.weight ?? 1), 0);

export const pluralize = (n, word, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;
