import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard, UtensilsCrossed, Wallet, MessagesSquare, Users, HandCoins, CircleCheck, ShieldCheck, Zap, Search } from "lucide-react";
import { Avatar } from "../../components/ui";
import { money } from "../../lib/format";
import { useCountUp, useTilt, scrollToId } from "./motion";

// Illustrative product data — the same shapes the real dashboard renders.
const TREND = [
  ["Jun", 58, 26], ["Jul", 64, 30], ["Aug", 52, 24], ["Sep", 70, 34], ["Oct", 66, 28], ["Nov", 82, 36],
];
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
  return (
    <div className="lp-win" aria-hidden>
      <div className="lp-win-bar">
        <span className="lp-win-home"><i>GV</i>Green Villa Mess</span>
        <span>· November</span>
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
          <div className="lp-win-head"><b>Good evening, Rahim</b><small>6 members · all synced</small></div>
          <div className="lp-tiles">
            <div className="lp-tile"><small>Spent this month</small><Counter to={4574100} render={(v) => money(v, "BDT").replace(/\.\d+$/, "")} /><em className="lp-neg">↑ 6% vs Oct</em></div>
            <div className="lp-tile"><small>Meal rate</small><Counter to={6244} render={(v) => money(v, "BDT")} /><em className="lp-pos">↓ ৳3.10</em></div>
            <div className="lp-tile"><small>Collected</small><Counter to={3400000} render={(v) => money(v, "BDT").replace(/\.\d+$/, "")} /><em className="lp-pos">5 of 6 paid</em></div>
          </div>
          <div className="lp-panels">
            <div className="lp-panel">
              <div className="lp-panel-t">Monthly spending <span>meals · other</span></div>
              <div className="lp-bars">
                {TREND.map(([m, a, b], i) => (
                  <div className="lp-bar" key={m}>
                    <i className="o" style={{ height: `${b}%`, transitionDelay: `${300 + i * 70}ms` }} />
                    <i className="m" style={{ height: `${a - b}%`, transitionDelay: `${300 + i * 70}ms` }} />
                    <small>{m}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-panel">
              <div className="lp-panel-t">Balances <span>live</span></div>
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
          <span className="lp-kicker" data-reveal>The better way to live together</span>
          <h1 id="hero-title">
            <span className="line" data-reveal style={{ "--d": "80ms" }}>Your home,</span>
            <span className="line" data-reveal style={{ "--d": "180ms" }}>minus the <span className="lp-serif lp-brandword">chaos.</span></span>
          </h1>
          <p className="lp-hero-desc" data-reveal style={{ "--d": "300ms" }}>
            One place for meals, expenses, payments, roommates — and everything that keeps a shared home running smoothly.
          </p>
          <div className="lp-hero-ctas" data-reveal style={{ "--d": "400ms" }}>
            <Link to="/register" className="lp-btn lp-btn-primary">Get started <ArrowRight /></Link>
            <a href="/#features" className="lp-btn lp-btn-ghost" onClick={(e) => scrollToId(e, "features")}>Explore the platform</a>
          </div>
          <div className="lp-hero-meta" data-reveal style={{ "--d": "520ms" }}>
            <span><Zap /> Set up in two minutes</span>
            <span><ShieldCheck /> Every taka on a ledger</span>
          </div>
        </div>

        <div className="lp-stage" data-reveal="scale" style={{ "--d": "250ms" }}>
          <div className="lp-stage-inner" ref={tilt}>
            <ProductWindow />
            <div className="lp-float lp-float-rate" aria-hidden>
              <small>Meal rate today</small>
              <b className="num">৳62.44</b>
            </div>
            <div className="lp-float lp-float-meal" aria-hidden>
              <span className="lp-float-ico" style={{ background: "var(--lp-brand-soft)", color: "var(--lp-brand-ink)" }}><UtensilsCrossed /></span>
              <div><b>13 meals</b><small>planned tonight</small></div>
            </div>
            <div className="lp-float lp-float-pay" aria-hidden>
              <span className="lp-float-ico" style={{ background: "var(--lp-coral-soft)", color: "var(--lp-coral)" }}><HandCoins /></span>
              <div>
                <b>Karim paid ৳1,250</b>
                <small>via bKash · just now</small>
              </div>
              <CircleCheck size={16} style={{ color: "#16a34a", marginLeft: 6 }} />
            </div>
            <div className="lp-float lp-float-chat" aria-hidden>
              <small>Home chat · Sakib</small>
              <div className="lp-bubble">Bazar done 🛒 receipt is on the expense</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
