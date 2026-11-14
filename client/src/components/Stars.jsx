import { useState } from "react";
import { Star } from "lucide-react";
import { translate } from "../i18n";
import { num } from "../lib/format";

/** Read-only star rating (supports halves visually via fill width). */
export function Stars({ value = 0, size = 14, showValue, count }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="stars" aria-label={value ? `${translate("stars.outOf", { value })}${count !== undefined ? `, ${translate("stars.reviews", { count })}` : ""}` : translate("stars.none")} title={value ? `${num(value)} / ${num(5)}` : translate("stars.none")}>
      <span className="stars-track" style={{ "--s": `${size}px` }}>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} />)}
        <span className="stars-fill" style={{ width: `${pct}%` }}>
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} />)}
        </span>
      </span>
      {showValue && <span className="stars-value">{value ? num(Number(value.toFixed(1))) : translate("stars.new")}{count !== undefined && <span className="stars-count"> ({num(count)})</span>}</span>}
    </span>
  );
}

/** Interactive 1–5 star input. */
export function StarInput({ value, onChange, size = 26, label = translate("reviews.rating") }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const words = ["", ...[1, 2, 3, 4, 5].map((n) => translate(`stars.word${n}`))];
  return (
    <div className="row" style={{ gap: 10 }}>
      <div role="radiogroup" aria-label={label} className="row" style={{ gap: 2 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={translate("stars.n", { count: n })} className={`star-btn ${n <= shown ? "on" : ""}`}
            onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)} onClick={() => onChange(n)}>
            <Star size={size} />
          </button>
        ))}
      </div>
      <span className="text-sm muted" style={{ minWidth: 70 }}>{words[shown] || ""}</span>
    </div>
  );
}
