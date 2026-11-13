import { Crown, Check, Clock, Send } from "lucide-react";
import { Avatar } from "../../components/ui";

export function Statement() {
  return (
    <section className="lp-statement" id="about" aria-labelledby="about-title">
      <div className="lp-wrap">
        <span className="lp-kicker" data-reveal>Why BachelorMate</span>
        <p className="big" id="about-title" data-reveal style={{ "--d": "80ms" }}>
          One home. Many people. <span className="lp-serif">Everything</span> in sync<span className="dim"> — the bazar, the bills, the dinner count and the person who still owes for the gas.</span>
        </p>
        <div className="lp-principles">
          {[
            ["01", "Fair by design", "Meal rates and shared bills split to the paisa. Nobody does the math on a napkin again."],
            ["02", "Honest money", "Every payment and charge lands on a ledger. Mistakes are reversed, never quietly edited."],
            ["03", "Roles with respect", "Admins, managers and meal managers see what they need — members see what's theirs."],
          ].map(([n, t, d], i) => (
            <div key={n} data-reveal style={{ "--d": `${i * 100}ms` }}>
              <i>{n}</i>
              <b>{t}</b>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MEAL_ROWS = [
  ["Rahim", ["on", "on", "guest"]],
  ["Karim", ["on", "off", "on"]],
  ["Sakib", ["on", "on", "on"]],
  ["Tanvir", ["off", "on", "on"]],
  ["Nayeem", ["off", "on", "on"]],
];

export function Features() {
  return (
    <section className="lp-features" id="features" aria-labelledby="features-title">
      <div className="lp-wrap">
        <div className="lp-sechead">
          <div>
            <span className="lp-kicker" data-reveal>The platform</span>
            <h2 className="lp-h2" id="features-title" data-reveal style={{ "--d": "80ms" }}>
              Everything a shared home <span className="lp-serif lp-brandword">actually</span> needs.
            </h2>
          </div>
          <p className="lp-lead" data-reveal style={{ "--d": "160ms" }}>Six tools that talk to each other — so a meal-off request updates the meal rate, and the meal rate updates everyone's balance.</p>
        </div>

        <div className="lp-bento">
          <article className="lp-card c-home" data-reveal>
            <div>
              <span className="lp-tag">01 — Home management</span>
              <h3 style={{ marginTop: 10 }}>Run one home, or five.</h3>
              <p>Separate books, members and chat for every place you live. Invite with a link or an 8-character code.</p>
            </div>
            <div className="lp-card-viz v-homes" aria-hidden>
              <div className="v-homelist">
                <div className="on"><i>GV</i>Green Villa Mess<small>6 members</small></div>
                <div><i>DH</i>Dhanmondi Flat 4B<small>3 members</small></div>
                <div><i>OH</i>Office hostel<small>Pending</small></div>
              </div>
              <div className="v-code">
                <small>Home code</small>
                <b>K7M2QX9A</b>
                <span className="lp-chip lp-chip-brand" style={{ justifySelf: "start" }}>Approval required</span>
              </div>
            </div>
          </article>

          <article className="lp-card c-meal" data-reveal style={{ "--d": "100ms" }}>
            <div>
              <span className="lp-tag">02 — Smart meal tracking</span>
              <h3 style={{ marginTop: 10 }}>The meal rate does itself.</h3>
              <p>Breakfast, lunch and dinner per person, guest meals and meal-offs — with a fair rate that updates live.</p>
            </div>
            <div className="lp-card-viz" aria-hidden>
              <div className="v-mealgrid">
                <span />
                <span>B</span><span>L</span><span>D</span>
                {MEAL_ROWS.map(([n, cells]) => (
                  <FragmentRow key={n} name={n} cells={cells} />
                ))}
              </div>
              <div className="v-mealfoot"><span>Tonight's rate</span><b className="num">৳62.44</b></div>
            </div>
          </article>

          <article className="lp-card c-exp" data-reveal style={{ "--d": "60ms" }}>
            <div>
              <span className="lp-tag">03 — Shared expenses</span>
              <h3 style={{ marginTop: 10 }}>Split to the paisa.</h3>
            </div>
            <div className="lp-card-viz v-split" aria-hidden>
              <div className="v-split-total"><span>Electricity</span><b className="num">৳2,875.50</b></div>
              <div className="v-splitbar">{[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ "--k": k }} />)}</div>
              <div className="v-split-rows">
                <span>Rahim <b>৳575.10</b></span><span>Karim <b>৳575.10</b></span>
                <span>Sakib <b>৳575.10</b></span><span>+2 more <b>৳575.10</b></span>
              </div>
            </div>
          </article>

          <article className="lp-card c-mem" data-reveal style={{ "--d": "120ms" }}>
            <div>
              <span className="lp-tag">04 — Members & roles</span>
              <h3 style={{ marginTop: 10 }}>Everyone in their lane.</h3>
            </div>
            <div className="lp-card-viz v-members" aria-hidden>
              {[["Rahim Ahmed", "Admin", "lp-chip-brand", Crown], ["Karim Hossain", "Manager", "lp-chip-mute"], ["Sakib Hasan", "Meal manager", "lp-chip-coral"], ["Tanvir Islam", "Member", "lp-chip-mute"]].map(([n, r, c, I]) => (
                <div key={n}><Avatar user={{ name: n }} size={26} /><span>{n}</span><span className={`lp-chip ${c}`} style={{ flex: "none" }}>{I && <I size={11} />}{r}</span></div>
              ))}
            </div>
          </article>

          <article className="lp-card c-chat" data-reveal style={{ "--d": "60ms" }}>
            <div>
              <span className="lp-tag">05 — Real-time chat</span>
              <h3 style={{ marginTop: 10 }}>A group chat that knows the house.</h3>
              <p>Private chat for every home, plus direct messages with friends. Typing, read receipts and who's online.</p>
            </div>
            <div className="lp-card-viz v-chat" aria-hidden>
              <div className="row"><Avatar user={{ name: "Sakib Hasan" }} size={24} /><div className="lp-bubble">Khichuri on Friday? 🍲</div></div>
              <div className="row" style={{ justifyContent: "flex-end" }}><div className="lp-bubble me">Yes please. I'll get the beef.</div></div>
              <div className="row"><Avatar user={{ name: "Tanvir Islam" }} size={24} /><div className="lp-typing"><i /><i /><i /></div></div>
            </div>
          </article>

          <article className="lp-card c-pay" data-reveal style={{ "--d": "120ms" }}>
            <div>
              <span className="lp-tag">06 — Payment tracking</span>
              <h3 style={{ marginTop: 10 }}>Know who paid. Instantly.</h3>
              <p>Members submit bKash or cash payments; managers confirm with one tap.</p>
            </div>
            <div className="lp-card-viz v-pay" aria-hidden>
              <div><Avatar user={{ name: "Karim Hossain" }} size={26} /><span>Karim · bKash</span><b>৳1,250</b><span className="lp-chip lp-chip-lime" style={{ flex: "none" }}><Check size={11} />Confirmed</span></div>
              <div><Avatar user={{ name: "Nayeem Khan" }} size={26} /><span>Nayeem · cash</span><b>৳3,000</b><span className="lp-chip lp-chip-coral" style={{ flex: "none" }}><Clock size={11} />Pending</span></div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function FragmentRow({ name, cells }) {
  return (
    <>
      <b>{name}</b>
      {cells.map((c, i) => (
        <span key={i} className={`v-dot ${c}`}>{c === "guest" ? "+1" : c === "on" ? "1" : ""}</span>
      ))}
    </>
  );
}

export function HowItWorks() {
  return (
    <section className="lp-how" id="how" aria-labelledby="how-title">
      <div className="lp-wrap">
        <span className="lp-kicker" data-reveal>How it works</span>
        <h2 className="lp-h2" id="how-title" data-reveal style={{ "--d": "80ms" }}>
          From group chat chaos<br />to <span className="lp-serif lp-brandword">calm</span> in three steps.
        </h2>
        <div className="lp-steps" data-reveal="fade">
          <div className="lp-step" data-reveal style={{ "--d": "150ms" }}>
            <span className="lp-step-n">01</span>
            <h3>Create your home</h3>
            <p>Name it, set house rules, meal types and the notice period. Two minutes, tops.</p>
            <div className="lp-step-ui" aria-hidden>
              <small style={{ color: "var(--lp-ink-3)" }}>Home name</small>
              <div className="lp-input-fake">Green Villa Mess</div>
            </div>
          </div>
          <div className="lp-step" data-reveal style={{ "--d": "300ms" }}>
            <span className="lp-step-n">02</span>
            <h3>Invite your roommates</h3>
            <p>Share a link or your home code. They read the rules, accept, and they're in.</p>
            <div className="lp-step-ui" aria-hidden>
              <div className="r"><span style={{ display: "flex" }}>{["Karim Hossain", "Sakib Hasan", "Tanvir Islam"].map((n, i) => <span key={n} style={{ marginLeft: i ? -8 : 0 }}><Avatar user={{ name: n }} size={26} /></span>)}</span><span className="lp-chip lp-chip-brand"><Send size={11} />3 invited</span></div>
            </div>
          </div>
          <div className="lp-step" data-reveal style={{ "--d": "450ms" }}>
            <span className="lp-step-n">03</span>
            <h3>Manage everything together</h3>
            <p>Meals, bazar, rent and dues stay in sync — and everyone can see their own numbers.</p>
            <div className="lp-step-ui" aria-hidden>
              <div className="r"><span>Your balance</span><b className="lp-pos num">+৳1,250.00</b></div>
              <div className="r"><span style={{ color: "var(--lp-ink-3)" }}>Advance credit</span><span className="lp-chip lp-chip-lime">Settled</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
