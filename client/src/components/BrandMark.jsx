// BachelorMate logo mark: a home holding a shared, steaming bowl.
// The tile follows the user's accent colour; source of truth is the Figma "Logo/Mark" component.
export default function BrandMark({ size = 26, className = "", title }) {
  return (
    <svg
      className={`brand-svg ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="64" height="64" rx="16" style={{ fill: "var(--accent)" }} />
      <rect x="40" y="16" width="5.5" height="10" rx="1.2" style={{ fill: "var(--on-accent)" }} />
      <path
        d="M12.5 29.2 30.1 14.6a3 3 0 0 1 3.8 0L51.5 29.2V47.5a4 4 0 0 1-4 4h-31a4 4 0 0 1-4-4Z"
        style={{ fill: "var(--on-accent)" }}
      />
      <path d="M20.5 36.5h23a11.5 9.5 0 0 1-23 0Z" style={{ fill: "var(--accent)" }} />
      <path
        d="M28 32c-1.8-1.6 1.8-3.4 0-6.2M36 32c-1.8-1.6 1.8-3.4 0-6.2"
        stroke="#FF6F4F"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// "Bachelor" in the UI face + "Mate" in Instrument Serif italic, as in the brand guide.
export function Wordmark() {
  return (
    <span className="wordmark">
      Bachelor<span className="wordmark-mate">Mate</span>
    </span>
  );
}
