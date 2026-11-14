import { Link } from "react-router-dom";
import { CircleCheck, ArrowRight, ShoppingBasket, HandCoins, Zap, MoonStar, UserPlus, Receipt, Send, Lock } from "lucide-react";
import { Avatar } from "../../components/ui";
import { money } from "../../lib/format";
import { useCountUp, REPO_URL, scrollToId } from "./motion";
import { GithubIcon, Logo } from "./Nav";

const CATS = [
  ["Groceries", 41, "var(--lp-brand)"],
  ["Rent", 32, "#c6b8ff"],
  ["Utilities", 12, "var(--lp-coral)"],
  ["Internet", 6, "var(--lp-lime)"],
  ["Other", 9, "rgb(255 255 255 / 0.3)"],
];
const BALANCES = [
  ["Rahim", 125000],
  ["Sakib", 8000],
  ["Tanvir", -21050],
  ["Karim", -64000],
];

export function FinanceShowcase() {
  const [ref, total] = useCountUp(4574100, 1600);
  return (
    <section className="lp-finance" id="finance" aria-labelledby="finance-title">
      <div className="lp-finance-stage">
        <div className="lp-fin-grid">
          <div>
            <span className="lp-kicker" data-reveal>Shared money, finally clear</span>
            <h2 className="lp-h2" id="finance-title" data-reveal style={{ "--d": "80ms" }}>
              A ledger your whole <span className="lp-serif" style={{ color: "var(--lp-lime)" }}>flat</span> can trust.
            </h2>
            <p className="lp-lead" data-reveal style={{ "--d": "160ms" }}>
              Bazar, rent, bills and deposits all land on each member's account — so the balance is never an argument.
            </p>
            <div className="lp-checks">
              {[
                "Split bills equally, between chosen members, or from the home fund",
                "Members submit payments; managers confirm in one tap",
                "Positive balance means advance, negative means dues — always visible",
                "Corrections are reversals with a reason, never silent edits",
              ].map((t, i) => (
                <div key={t} data-reveal style={{ "--d": `${200 + i * 70}ms` }}><CircleCheck />{t}</div>
              ))}
            </div>
          </div>

          <div className="lp-fin-comp" aria-hidden>
            <div className="lp-dcard balance" data-reveal="scale">
              <small>Your balance</small>
              <span className="big">+৳1,250</span>
              <span className="lp-chip" style={{ background: "rgb(255 255 255 / 0.16)", color: "#fff", marginTop: 12 }}>Advance credit</span>
            </div>
            <div className="lp-dcard" data-reveal="scale" style={{ "--d": "90ms" }}>
              <small>Spent in November</small>
              <span className="big" ref={ref}>{money(total, "BDT").replace(/\.\d+$/, "")}</span>
              <small style={{ marginTop: 8 }}>৳9,365 on meals · rate ৳62.44</small>
            </div>
            <div className="lp-dcard wide" data-reveal="scale" style={{ "--d": "160ms" }}>
              <small>Where it went</small>
              <div className="lp-cats">
                {CATS.map(([n, w, c], i) => <i key={n} style={{ flex: w, background: c, transitionDelay: `${i * 90}ms` }} />)}
              </div>
              <div className="lp-legend">{CATS.map(([n, w, c]) => <span key={n}><i style={{ background: c }} />{n} {w}%</span>)}</div>
            </div>
            <div className="lp-dcard" data-reveal="scale" style={{ "--d": "220ms" }}>
              <small>Recent transactions</small>
              <div className="lp-tx">
                <div><span className="ic" style={{ color: "var(--lp-lime)" }}><HandCoins /></span><span>Karim<small>bKash deposit</small></span><b className="in">+৳1,250</b></div>
                <div><span className="ic"><ShoppingBasket /></span><span>Weekly bazar<small>paid by Sakib</small></span><b className="out">৳1,850</b></div>
                <div><span className="ic"><Zap /></span><span>Electricity<small>split by 5</small></span><b className="out">৳575</b></div>
              </div>
            </div>
            <div className="lp-dcard" data-reveal="scale" style={{ "--d": "280ms" }}>
              <small>Member balances</small>
              <div className="lp-mini-bal">
                {BALANCES.map(([n, v]) => {
                  const w = Math.min(50, (Math.abs(v) / 130000) * 50);
                  return (
                    <div key={n}>
                      <span>{n}</span>
                      <span className="track"><i style={{ left: v >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? "var(--lp-lime)" : "var(--lp-coral)" }} /></span>
                      <b style={{ color: v >= 0 ? "var(--lp-lime)" : "var(--lp-coral)" }}>{money(v, "BDT", { sign: true }).replace(/\.\d+$/, "")}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const BOARD = [
  ["Rahim Ahmed", [1, 1, 1], [0, 0, 1]],
  ["Karim Hossain", [1, 0, 1], [0, 0, 0]],
  ["Sakib Hasan", [1, 1, 1], [0, 0, 0]],
  ["Tanvir Islam", [0, 0, 0], [0, 0, 0]],
  ["Nayeem Khan", [0, 1, 1], [0, 0, 0]],
];

export function MealShowcase() {
  return (
    <section className="lp-meals" id="meals" aria-labelledby="meals-title">
      <div className="lp-wrap lp-meal-grid">
        <div className="lp-board" data-reveal="scale" aria-hidden>
          <div className="lp-req">
            <div className="r">
              <Avatar user={{ name: "Tanvir Islam" }} size={30} />
              <div style={{ minWidth: 0 }}>
                <b>Tanvir · Meal off</b>
                <div style={{ color: "var(--lp-ink-3)", fontSize: 11.5 }}>Today · all meals · going home</div>
              </div>
            </div>
            <div className="acts"><span className="no">Decline</span><span className="yes">Approve</span></div>
          </div>
          <div className="lp-board-main">
            <div className="lp-board-head">
              <div><b>Today's meals</b><small>Friday, 13 Nov · filled from defaults</small></div>
              <span className="lp-chip lp-chip-coral"><UserPlus size={11} />1 guest</span>
            </div>
            <table>
              <thead><tr><th>Member</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th className="hm">Guests</th></tr></thead>
              <tbody>
                {BOARD.map(([n, m, g]) => (
                  <tr key={n}>
                    <td><Avatar user={{ name: n }} size={24} />{n.split(" ")[0]}</td>
                    {m.map((v, i) => <td key={i}><span className={`lp-pill ${v ? "" : "off"}`}>{v}</span></td>)}
                    <td className="hm">{g.some(Boolean) ? <span className="lp-pill guest">+{g.reduce((a, b) => a + b, 0)}</span> : <span style={{ color: "var(--lp-ink-3)" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="lp-board-foot"><span><b>10 meals</b> + 1 guest tonight</span><span>Rate so far <b className="num">৳62.44</b></span></div>
          </div>
          <div className="lp-receipt">
            <b>WEEKLY BAZAR · KAWRAN</b>
            <div className="r"><span>Rice 25kg</span><span>1,800</span></div>
            <div className="r"><span>Oil 5L</span><span>950</span></div>
            <div className="r"><span>Vegetables</span><span>640</span></div>
            <div className="r t"><span>Meal pool</span><span>৳3,390</span></div>
          </div>
        </div>

        <div className="lp-meal-copy">
          <span className="lp-kicker" data-reveal>Meals, handled</span>
          <h2 className="lp-h2" data-reveal style={{ "--d": "80ms" }} id="meals-title">
            Who's eating tonight? <span className="lp-serif" style={{ color: "var(--lp-coral-ink)" }}>Sorted.</span>
          </h2>
          <div className="lp-meal-points">
            {[
              [MoonStar, "Meal-off before the deadline", "Members request a day off before cut-off; the meal manager approves and the list updates itself."],
              [UserPlus, "Guests without awkwardness", "Bring a cousin for dinner — guest meals are counted and charged to the right person."],
              [Receipt, "Bazar becomes the meal rate", "Grocery expenses feed the meal pool. Close the month and everyone's share posts automatically."],
            ].map(([I, t, d], i) => (
              <div key={t} data-reveal style={{ "--d": `${150 + i * 90}ms` }}>
                <i><I /></i>
                <div><b>{t}</b><span>{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChatShowcase() {
  return (
    <section className="lp-chatsec" id="chat" aria-labelledby="chat-title">
      <div className="lp-wrap lp-chat-grid">
        <div>
          <span className="lp-kicker" data-reveal>Talk it out</span>
          <h2 className="lp-h2" id="chat-title" data-reveal style={{ "--d": "80ms" }}>
            The house group chat, <span className="lp-serif lp-brandword">grown up.</span>
          </h2>
          <p className="lp-lead" data-reveal style={{ "--d": "160ms" }}>
            Every home gets its own private chat — only current members can read it. And friend chats stay separate, so you can message people across homes.
          </p>
          <div className="lp-hero-meta" data-reveal style={{ "--d": "240ms" }}>
            <span><Zap /> Real-time</span>
            <span><Lock /> Members only</span>
            <span><CircleCheck /> Read receipts</span>
          </div>
        </div>
        <div className="lp-phones" data-reveal="fade" aria-hidden>
          <div className="lp-phone">
            <div className="lp-phone-screen">
              <div className="lp-phone-head">
                <span className="lp-mark" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>GV</span>
                <div><b>Green Villa chat</b><small><i />4 online</small></div>
              </div>
              <div className="lp-phone-body">
                <div className="who lp-msg-in" style={{ transitionDelay: "200ms" }}>Karim</div>
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "200ms" }}>Water's off Friday 10–4. Store some tonight 💧</div>
                <div className="who lp-msg-in" style={{ transitionDelay: "550ms" }}>Sakib</div>
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "550ms" }}>Bazar done 🛒 Receipt is on the expense.</div>
                <div className="lp-bubble me lp-msg-in" style={{ transitionDelay: "900ms" }}>Legend. Khichuri on Friday then?</div>
                <div className="seen lp-msg-in" style={{ transitionDelay: "1100ms" }}>Seen by 3</div>
                <div className="lp-typing lp-msg-in" style={{ transitionDelay: "1300ms" }}><i /><i /><i /></div>
              </div>
              <div className="lp-phone-compose">Message Green Villa…<span><Send /></span></div>
            </div>
          </div>
          <div className="lp-phone">
            <div className="lp-phone-screen">
              <div className="lp-phone-head">
                <Avatar user={{ name: "Ayesha Rahman" }} size={34} />
                <div><b>Ayesha Rahman</b><small><i />Online · friend</small></div>
              </div>
              <div className="lp-phone-body">
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "400ms" }}>Is there a room free in your mess next month?</div>
                <div className="lp-bubble me lp-msg-in" style={{ transitionDelay: "800ms" }}>Tanvir leaves on the 30th — I'll send you an invite link 🙌</div>
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "1200ms" }}>Perfect, thank you!</div>
                <div className="seen lp-msg-in" style={{ transitionDelay: "1400ms" }}>Seen</div>
              </div>
              <div className="lp-phone-compose">Message Ayesha…<span><Send /></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="lp-cta" aria-labelledby="cta-title">
      <div className="lp-cta-box" data-reveal="scale">
        <h2 id="cta-title">Make living together feel <span className="lp-serif">effortless.</span></h2>
        <p>Free to start. Bring your roommates in with a single link.</p>
        <div className="lp-hero-ctas">
          <Link to="/register" className="lp-btn lp-btn-primary">Create your first home <ArrowRight /></Link>
          <Link to="/login" className="lp-btn lp-btn-ghost">I have an invite</Link>
        </div>
      </div>
    </section>
  );
}

const anchor = (id, label) => (
  <a href={`/#${id}`} onClick={(e) => scrollToId(e, id)}>{label}</a>
);

export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-foot-grid">
          <div className="lp-foot-brand">
            <Logo />
            <p>The calm way to run a shared home — meals, money, people and conversations in one place.</p>
          </div>
          <div className="lp-foot-col">
            <h4>Product</h4>
            {anchor("features", "Features")}
            {anchor("how", "How it works")}
            {anchor("finance", "Finance")}
            {anchor("meals", "Meals")}
            {anchor("chat", "Chat")}
          </div>
          <div className="lp-foot-col">
            <h4>Company</h4>
            {anchor("about", "About")}
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">Contact</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">Source code</a>
          </div>
          <div className="lp-foot-col">
            <h4>Legal</h4>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
          <div className="lp-foot-col">
            <h4>Account</h4>
            <Link to="/register">Create account</Link>
            <Link to="/login">Log in</Link>
            <Link to="/join">Join with a code</Link>
          </div>
        </div>
        <div className="lp-foot-word" aria-hidden>BachelorMate</div>
        <div className="lp-foot-bottom">
          <span>© {new Date().getFullYear()} BachelorMate. Made for shared homes.</span>
          <div className="lp-social">
            <a className="lp-iconbtn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="BachelorMate on GitHub"><GithubIcon /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
