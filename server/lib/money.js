// Money is stored as integer minor units (e.g. paisa / cents) to avoid floating
// point drift. All arithmetic here is integer-only.
const { badRequest } = require("./http");

const MAX_MINOR = 1e13; // ~100 billion major units – a generous sanity cap.

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
/**
 * People on a Bangla keyboard type "১,২০০.৫০" or "৳১২০". Map Bangla digits to
 * 0–9 and drop grouping commas, spaces and the taka sign so it parses like "1200.50".
 */
const normalizeAmount = (input) =>
  String(input)
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[,\s৳]/g, "");

/** Convert a major-unit input ("120.5", 120.5, "1,200", "১২০.৫০") to integer minor units. */
function toMinor(input, { allowZero = false, allowNegative = false } = {}) {
  if (input === null || input === undefined || input === "") throw badRequest("Amount is required");
  const str = normalizeAmount(input);
  if (str === "") throw badRequest("Amount is required");
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) throw badRequest("Amount must be a number with at most 2 decimals");
  const negative = str.startsWith("-");
  const [whole, frac = ""] = str.replace("-", "").split(".");
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  const value = negative ? -minor : minor;
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MINOR) throw badRequest("Amount is too large");
  if (!allowNegative && value < 0) throw badRequest("Amount cannot be negative");
  if (!allowZero && value === 0) throw badRequest("Amount must be greater than zero");
  return value;
}

/**
 * Split an integer total across weights using the largest-remainder method so
 * the parts always sum exactly to the total.
 * @param {number} total integer minor units
 * @param {number[]} weights non-negative numbers
 */
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map((r) => Math.floor(r));
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) parts[order[k].i] += 1;
  return parts;
}

const fromMinor = (minor) => (minor / 100).toFixed(2);

module.exports = { toMinor, allocate, fromMinor, normalizeAmount };
