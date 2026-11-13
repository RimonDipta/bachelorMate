import { Link } from "react-router-dom";
import { Soup, UtensilsCrossed, Wallet, MessagesSquare } from "lucide-react";

export function Brand() {
  return (
    <Link to="/" className="row" style={{ color: "var(--text)", fontWeight: 650, textDecoration: "none" }}>
      <span className="brand-mark"><Soup size={15} /></span>
      BachelorMate
    </Link>
  );
}

const points = [
  { icon: UtensilsCrossed, title: "Meals without the notebook", text: "Daily meal lists, meal-off requests and a fair, automatic meal rate." },
  { icon: Wallet, title: "Money everyone can trust", text: "Every taka is on a ledger — dues, advances and receipts, never silently edited." },
  { icon: MessagesSquare, title: "One place to talk", text: "Private home chat, announcements and friends — all in real time." },
];

export default function AuthLayout({ children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <div className="auth-card">
          <Brand />
          {children}
        </div>
      </div>
      <aside className="auth-aside" aria-hidden>
        <div className="stack-lg" style={{ maxWidth: 400 }}>
          {points.map((p) => (
            <div key={p.title} className="row-3" style={{ alignItems: "flex-start" }}>
              <div className="feature-icon" style={{ marginBottom: 0 }}><p.icon /></div>
              <div>
                <div className="strong">{p.title}</div>
                <div className="muted text-sm" style={{ marginTop: 2 }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
