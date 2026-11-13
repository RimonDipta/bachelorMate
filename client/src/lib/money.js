// Client-side mirror of the server's money helpers, used only for live
// previews. The server recomputes everything authoritatively.

/** "120.5" → 12050, or null when the text isn't a valid amount. */
export function parseMinor(text) {
  const s = String(text ?? "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export const minorToInput = (minor) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

/** Largest-remainder split: the parts always sum exactly to the total. */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map((r) => Math.floor(r));
  let rem = total - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; rem > 0 && k < order.length; k++, rem--) parts[order[k].i] += 1;
  return parts;
}
