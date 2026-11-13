import { Link } from "react-router-dom";
import { ArrowRight, UtensilsCrossed, Wallet, MessagesSquare, ShieldCheck, Users, CalendarDays, Sparkles } from "lucide-react";
import { Brand } from "./auth/AuthLayout";
import { Avatar } from "../components/ui";

const features = [
  { icon: UtensilsCrossed, title: "Meal management", text: "Breakfast, lunch and dinner per member, guest meals, meal-off requests with deadlines, and a meal rate that calculates itself." },
  { icon: Wallet, title: "Transparent ledger", text: "Payments, shared bills and meal charges land on each member's account. Dues and advances are always one glance away." },
  { icon: Users, title: "Roles that make sense", text: "Admin, Manager, Meal Manager and Member — each sees and does exactly what they should. Nothing more." },
  { icon: MessagesSquare, title: "Real-time chat", text: "A private chat for each home, plus one-to-one messages with friends. Typing indicators, read receipts, presence." },
  { icon: CalendarDays, title: "Calendar & requests", text: "Departures with notice periods, absences, payment deadlines and house events — all in one shared calendar." },
  { icon: ShieldCheck, title: "Built to be trusted", text: "Every money change is auditable. Corrections are reversals, never silent edits. Each home's data stays its own." },
];

function Preview() {
  const rows = [
    { name: "Rahim", meals: 42, bal: "+৳1,250.00", pos: true },
    { name: "Karim", meals: 38.5, bal: "−৳640.00" },
    { name: "Sakib", meals: 45, bal: "+৳80.00", pos: true },
  ];
  return (
    <div className="card preview-card" aria-hidden>
      <div className="card-head">
        <h3>Green Villa · November</h3>
        <span className="badge badge-accent">Meal rate ৳62.40</span>
      </div>
      <div className="grid-3" style={{ padding: 16, gap: 12 }}>
        {[["Meal expenses", "৳18,420"], ["Collected", "৳24,000"], ["Members", "6"]].map(([l, v]) => (
          <div key={l} className="col" style={{ gap: 2 }}>
            <span className="text-xs muted">{l}</span>
            <span className="strong num" style={{ fontSize: 18 }}>{v}</span>
          </div>
        ))}
      </div>
      <hr className="divider" />
      {rows.map((r) => (
        <div key={r.name} className="list-item">
          <Avatar user={{ name: r.name }} size={28} />
          <span className="grow strong text-sm">{r.name}</span>
          <span className="text-sm muted num">{r.meals} meals</span>
          <span className={`text-sm strong num ${r.pos ? "pos" : "neg"}`} style={{ width: 96, textAlign: "right" }}>{r.bal}</span>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <div>
      <nav className="landing-nav">
        <Brand />
        <div className="row">
          <Link to="/login" className="btn btn-ghost">Sign in</Link>
          <Link to="/register" className="btn btn-primary">Get started</Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> For messes, flats and shared homes</span>
          <h1>Shared living, without the spreadsheet.</h1>
          <p className="lead">BachelorMate keeps your home's meals, bazar costs, rent and conversations in one calm place — so everyone knows exactly what they owe, and nobody has to chase.</p>
          <div className="row wrap" style={{ marginTop: 28, gap: 10 }}>
            <Link to="/register" className="btn btn-primary" style={{ height: 42, padding: "0 18px" }}>Create your home <ArrowRight size={16} /></Link>
            <Link to="/login" className="btn btn-secondary" style={{ height: 42, padding: "0 18px" }}>I have an invite</Link>
          </div>
        </div>
        <Preview />
      </section>
      <section className="feature-grid">
        {features.map((f) => (
          <div key={f.title} className="card feature">
            <div className="feature-icon"><f.icon /></div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="subtle text-xs" style={{ textAlign: "center", padding: "0 0 40px" }}>© {new Date().getFullYear()} BachelorMate</footer>
    </div>
  );
}
