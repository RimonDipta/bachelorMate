import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard, UtensilsCrossed, Wallet, MessagesSquare, Users, HandCoins, CircleCheck, ShieldCheck, Zap, Search } from "lucide-react";
import { Avatar } from "../../components/ui";
import { money } from "../../lib/format";
import { useI18n, useT } from "../../i18n/I18nProvider";
import { useCountUp, useTilt, scrollToId } from "./motion";

// Illustrative product data — the same shapes the real dashboard renders.
// Months 5–10 (Jun–Nov), labelled in the chosen language.
const TREND = [[5, 58, 26], [6, 64, 30], [7, 52, 24], [8, 70, 34], [9, 66, 28], [10, 82, 36]];
const PEOPLE = [
  { name: "Rahim Ahmed", bal: 125000 },
  { name: "Karim Hossain", bal: -64000 },
  { name: "Sakib Hasan", bal: 8000 },
  { name: "Tanvir Islam", bal: -21050 },
];

function Counter({ to, render }) {
  const [ref, v] = useCountUp(to);
  return <b ref={ref} className="num">{render(v)}</b>;
}

function ProductWindow() {
  const { t, locale } = useI18n();
  const monthName = (m) => new Date(2024, m, 1).toLocaleDateString(locale, { month: "short" });
  return (
    <div className="lp-win" aria-hidden>
      <div className="lp-win-bar">
        <span className="lp-win-home"><i>GV</i>{t("lp.demoHome")}</span>
        <span>· {new Date(2024, 10, 1).toLocaleDateString(locale, { month: "long" })}</span>
        <span className="lp-win-search"><Search size={12} /><kbd>⌘K</kbd></span>
      </div>
      <div className="lp-win-body">
        <div className="lp-win-rail">
          <span className="on"><LayoutDashboard /></span>
          <span><UtensilsCrossed /></span>
          <span><Wallet /></span>
          <span><MessagesSquare /></span>
          <span><Users /></span>
        </div>
        <div className="lp-win-main">
          <div className="lp-win-head"><b>{t("dashboard.greeting.evening", { name: t("lp.demoName") })}</b><small>{t("lp.synced", { n: 6 })}</small></div>
          <div className="lp-tiles">
            <div className="lp-tile"><small>{t("dashboard.spentThisMonth")}</small><Counter to={4574100} render={(v) => money(v, "BDT").replace(/[.][0-9০-৯]+(?=\D*$)/, "")} /><em className="lp-neg">{t("lp.vsOct", { n: 6, month: monthName(9) })}</em></div>
            <div className="lp-tile"><small>{t("meals.mealRate")}</small><Counter to={6244} render={(v) => money(v, "BDT")} /><em className="lp-pos">↓ {money(310, "BDT")}</em></div>
            <div className="lp-tile"><small>{t("finance.collected")}</small><Counter to={3400000} render={(v) => money(v, "BDT").replace(/[.][0-9০-৯]+(?=\D*$)/, "")} /><em className="lp-pos">{t("lp.paidOf", { a: 5, b: 6 })}</em></div>
          </div>
          <div className="lp-panels">
            <div className="lp-panel">
              <div className="lp-panel-t">{t("lp.monthlySpending")} <span>{t("lp.mealsOther")}</span></div>
              <div className="lp-bars">
                {TREND.map(([m, a, b], i) => (
                  <div className="lp-bar" key={m}>
                    <i className="o" style={{ height: `${b}%`, transitionDelay: `${300 + i * 70}ms` }} />
                    <i className="m" style={{ height: `${a - b}%`, transitionDelay: `${300 + i * 70}ms` }} />
                    <small>{monthName(m)}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-panel">
              <div className="lp-panel-t">{t("lp.balances")} <span>{t("lp.live")}</span></div>
              <div className="lp-people">
                {PEOPLE.map((p) => (
                  <div className="lp-person" key={p.name}>
                    <Avatar user={{ name: p.name }} size={22} />
                    <span>{p.name.split(" ")[0]}</span>
                    <b className={p.bal < 0 ? "lp-neg" : "lp-pos"}>{money(p.bal, "BDT", { sign: true })}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const tilt = useTilt(5);
  const t = useT();
  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-ambient" aria-hidden>
        <div className="lp-grid-bg" />
        <div className="lp-orb lp-orb-a" />
        <div className="lp-orb lp-orb-b" />
        <div className="lp-orb lp-orb-c" />
      </div>
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-kicker" data-reveal>{t("lp.hero.kicker")}</span>
          <h1 id="hero-title">
            <span className="line" data-reveal style={{ "--d": "80ms" }}>{t("lp.hero.line1")}</span>
            <span className="line" data-reveal style={{ "--d": "180ms" }}>{t("lp.hero.line2")}<span className="lp-serif lp-brandword">{t("lp.hero.word")}</span></span>
          </h1>
          <p className="lp-hero-desc" data-reveal style={{ "--d": "300ms" }}>
            {t("lp.hero.desc")}
          </p>
          <div className="lp-hero-ctas" data-reveal style={{ "--d": "400ms" }}>
            <Link to="/register" className="lp-btn lp-btn-primary">{t("landing.getStarted")} <ArrowRight /></Link>
            <a href="/#features" className="lp-btn lp-btn-ghost" onClick={(e) => scrollToId(e, "features")}>{t("lp.hero.explore")}</a>
          </div>
          <div className="lp-hero-meta" data-reveal style={{ "--d": "520ms" }}>
            <span><Zap /> {t("lp.hero.setup")}</span>
            <span><ShieldCheck /> {t("lp.hero.ledger")}</span>
          </div>
        </div>

        <div className="lp-stage" data-reveal="scale" style={{ "--d": "250ms" }}>
          <div className="lp-stage-inner" ref={tilt}>
            <ProductWindow />
            <div className="lp-float lp-float-rate" aria-hidden>
              <small>{t("lp.rateToday")}</small>
              <b className="num">{money(6244, "BDT")}</b>
            </div>
            <div className="lp-float lp-float-meal" aria-hidden>
              <span className="lp-float-ico" style={{ background: "var(--lp-brand-soft)", color: "var(--lp-brand-ink)" }}><UtensilsCrossed /></span>
              <div><b>{t("daily.mealsCount", { count: 13 })}</b><small>{t("lp.tonight")}</small></div>
            </div>
            <div className="lp-float lp-float-pay" aria-hidden>
              <span className="lp-float-ico" style={{ background: "var(--lp-coral-soft)", color: "var(--lp-coral)" }}><HandCoins /></span>
              <div>
                <b>{t("lp.paid", { name: t("lp.demoKarim"), amount: money(125000, "BDT").replace(/[.][0০]{2}(?=\D*$)/, "") })}</b>
                <small>{t("lp.viaBkash")} · {t("time.justNow")}</small>
              </div>
              <CircleCheck size={16} style={{ color: "#16a34a", marginLeft: 6 }} />
            </div>
            <div className="lp-float lp-float-chat" aria-hidden>
              <small>{t("nav.homeChat")} · {t("lp.demoSakib")}</small>
              <div className="lp-bubble">{t("lp.bubble")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
