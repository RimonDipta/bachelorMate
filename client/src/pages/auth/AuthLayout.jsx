import { Link } from "react-router-dom";
import { UtensilsCrossed, Wallet, MessagesSquare } from "lucide-react";
import BrandMark, { Wordmark } from "../../components/BrandMark";
import { useT } from "../../i18n/I18nProvider";
import { LanguageSwitch } from "../../components/LanguageSwitch";

export function Brand() {
  return (
    <Link to="/" className="row" style={{ color: "var(--text)", fontWeight: 650, textDecoration: "none" }}>
      <BrandMark size={28} />
      <Wordmark />
    </Link>
  );
}

const points = [
  { icon: UtensilsCrossed, key: "meals" },
  { icon: Wallet, key: "money" },
  { icon: MessagesSquare, key: "talk" },
];

export default function AuthLayout({ children }) {
  const t = useT();
  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <div className="auth-card">
          <div className="row between">
            <Brand />
            <LanguageSwitch />
          </div>
          {children}
        </div>
      </div>
      <aside className="auth-aside" aria-hidden>
        <div className="stack-lg" style={{ maxWidth: 400 }}>
          {points.map((p) => (
            <div key={p.key} className="row-3" style={{ alignItems: "flex-start" }}>
              <div className="feature-icon" style={{ marginBottom: 0 }}><p.icon /></div>
              <div>
                <div className="strong">{t(`auth.points.${p.key}.title`)}</div>
                <div className="muted text-sm" style={{ marginTop: 2 }}>{t(`auth.points.${p.key}.text`)}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
