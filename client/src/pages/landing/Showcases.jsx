import { Link } from "react-router-dom";
import { CircleCheck, ArrowRight, ShoppingBasket, HandCoins, Zap, MoonStar, UserPlus, Receipt, Send, Lock } from "lucide-react";
import { Avatar } from "../../components/ui";
import { useI18n, useT } from "../../i18n/I18nProvider";
import { CATEGORY_LABEL, money, num } from "../../lib/format";
import { useCountUp, REPO_URL, scrollToId } from "./motion";
import { GithubIcon, Logo } from "./Nav";

const takaWhole = (minor, opts) => money(minor, "BDT", opts).replace(/[.][0-9০-৯]+(?=\D*$)/, "");

const CATS = [
  ["groceries", 41, "var(--lp-brand)"],
  ["rent", 32, "#c6b8ff"],
  ["utilities", 12, "var(--lp-coral)"],
  ["internet", 6, "var(--lp-lime)"],
  ["other", 9, "rgb(255 255 255 / 0.3)"],
];
const BALANCES = [
  ["rahim", 125000],
  ["sakib", 8000],
  ["tanvir", -21050],
  ["karim", -64000],
];

export function FinanceShowcase() {
  const { t, locale } = useI18n();
  const [ref, total] = useCountUp(4574100, 1600);
  return (
    <section className="lp-finance" id="finance" aria-labelledby="finance-title">
      <div className="lp-finance-stage">
        <div className="lp-fin-grid">
          <div>
            <span className="lp-kicker" data-reveal>{t("lp.fin.kicker")}</span>
            <h2 className="lp-h2" id="finance-title" data-reveal style={{ "--d": "80ms" }}>
              {t("lp.fin.before")}<span className="lp-serif" style={{ color: "var(--lp-lime)" }}>{t("lp.fin.word")}</span>{t("lp.fin.after")}
            </h2>
            <p className="lp-lead" data-reveal style={{ "--d": "160ms" }}>{t("lp.fin.lead")}</p>
            <div className="lp-checks">
              {[1, 2, 3, 4].map((n, i) => (
                <div key={n} data-reveal style={{ "--d": `${200 + i * 70}ms` }}><CircleCheck />{t(`lp.fin.check${n}`)}</div>
              ))}
            </div>
          </div>

          <div className="lp-fin-comp" aria-hidden>
            <div className="lp-dcard balance" data-reveal="scale">
              <small>{t("lp.how.yourBalance")}</small>
              <span className="big">{takaWhole(125000, { sign: true })}</span>
              <span className="lp-chip" style={{ background: "rgb(255 255 255 / 0.16)", color: "#fff", marginTop: 12 }}>{t("lp.how.advanceCredit")}</span>
            </div>
            <div className="lp-dcard" data-reveal="scale" style={{ "--d": "90ms" }}>
              <small>{t("lp.fin.spentIn", { month: new Date(2024, 10, 1).toLocaleDateString(locale, { month: "long" }) })}</small>
              <span className="big" ref={ref}>{takaWhole(total)}</span>
              <small style={{ marginTop: 8 }}>{t("lp.fin.onMeals", { amount: takaWhole(936500), rate: money(6244, "BDT") })}</small>
            </div>
            <div className="lp-dcard wide" data-reveal="scale" style={{ "--d": "160ms" }}>
              <small>{t("lp.fin.whereWent")}</small>
              <div className="lp-cats">
                {CATS.map(([k, w, c], i) => <i key={k} style={{ flex: w, background: c, transitionDelay: `${i * 90}ms` }} />)}
              </div>
              <div className="lp-legend">{CATS.map(([k, w, c]) => <span key={k}><i style={{ background: c }} />{CATEGORY_LABEL[k]} {num(w)}%</span>)}</div>
            </div>
            <div className="lp-dcard" data-reveal="scale" style={{ "--d": "220ms" }}>
              <small>{t("lp.fin.recent")}</small>
              <div className="lp-tx">
                <div><span className="ic" style={{ color: "var(--lp-lime)" }}><HandCoins /></span><span>{t("lp.people.karim")}<small>{t("lp.fin.bkashDeposit")}</small></span><b className="in">{takaWhole(125000, { sign: true })}</b></div>
                <div><span className="ic"><ShoppingBasket /></span><span>{t("lp.fin.weeklyBazar")}<small>{t("lp.fin.paidBy", { name: t("lp.people.sakib") })}</small></span><b className="out">{takaWhole(185000)}</b></div>
                <div><span className="ic"><Zap /></span><span>{t("lp.features.exp.electricity")}<small>{t("lp.fin.splitBy", { n: 5 })}</small></span><b className="out">{takaWhole(57500)}</b></div>
              </div>
            </div>
            <div className="lp-dcard" data-reveal="scale" style={{ "--d": "280ms" }}>
              <small>{t("lp.fin.memberBalances")}</small>
              <div className="lp-mini-bal">
                {BALANCES.map(([k, v]) => {
                  const w = Math.min(50, (Math.abs(v) / 130000) * 50);
                  return (
                    <div key={k}>
                      <span>{t(`lp.people.${k}`)}</span>
                      <span className="track"><i style={{ left: v >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? "var(--lp-lime)" : "var(--lp-coral)" }} /></span>
                      <b style={{ color: v >= 0 ? "var(--lp-lime)" : "var(--lp-coral)" }}>{takaWhole(v, { sign: true })}</b>
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
  ["rahim", [1, 1, 1], [0, 0, 1]],
  ["karim", [1, 0, 1], [0, 0, 0]],
  ["sakib", [1, 1, 1], [0, 0, 0]],
  ["tanvir", [0, 0, 0], [0, 0, 0]],
  ["nayeem", [0, 1, 1], [0, 0, 0]],
];

export function MealShowcase() {
  const { t, locale } = useI18n();
  return (
    <section className="lp-meals" id="meals" aria-labelledby="meals-title">
      <div className="lp-wrap lp-meal-grid">
        <div className="lp-board" data-reveal="scale" aria-hidden>
          <div className="lp-req">
            <div className="r">
              <Avatar user={{ name: t("lp.peopleFull.tanvir") }} size={30} />
              <div style={{ minWidth: 0 }}>
                <b>{t("lp.people.tanvir")} · {t("common.mealOff")}</b>
                <div style={{ color: "var(--lp-ink-3)", fontSize: 11.5 }}>{t("lp.meal.reqDetail")}</div>
              </div>
            </div>
            <div className="acts"><span className="no">{t("requests.decline")}</span><span className="yes">{t("requests.approve")}</span></div>
          </div>
          <div className="lp-board-main">
            <div className="lp-board-head">
              <div><b>{t("dashboard.todaysMeals")}</b><small>{new Date(2026, 10, 13).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })} · {t("lp.meal.fromDefaults")}</small></div>
              <span className="lp-chip lp-chip-coral"><UserPlus size={11} />{t("daily.guestsCount", { count: 1 })}</span>
            </div>
            <table>
              <thead><tr><th>{t("common.member")}</th><th>{t("mealTypes.breakfast")}</th><th>{t("mealTypes.lunch")}</th><th>{t("mealTypes.dinner")}</th><th className="hm">{t("meals.guests")}</th></tr></thead>
              <tbody>
                {BOARD.map(([k, m, g]) => (
                  <tr key={k}>
                    <td><Avatar user={{ name: t(`lp.peopleFull.${k}`) }} size={24} />{t(`lp.people.${k}`)}</td>
                    {m.map((v, i) => <td key={i}><span className={`lp-pill ${v ? "" : "off"}`}>{num(v)}</span></td>)}
                    <td className="hm">{g.some(Boolean) ? <span className="lp-pill guest">+{num(g.reduce((a, b) => a + b, 0))}</span> : <span style={{ color: "var(--lp-ink-3)" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="lp-board-foot"><span><b>{t("daily.mealsCount", { count: 10 })}</b> {t("lp.meal.plusGuest", { n: 1 })}</span><span>{t("lp.meal.rateSoFar")} <b className="num">{money(6244, "BDT")}</b></span></div>
          </div>
          <div className="lp-receipt">
            <b>{t("lp.meal.receiptTitle")}</b>
            <div className="r"><span>{t("lp.meal.rice")}</span><span>{num(1800)}</span></div>
            <div className="r"><span>{t("lp.meal.oil")}</span><span>{num(950)}</span></div>
            <div className="r"><span>{t("lp.meal.veg")}</span><span>{num(640)}</span></div>
            <div className="r t"><span>{t("lp.meal.pool")}</span><span>{takaWhole(339000)}</span></div>
          </div>
        </div>

        <div className="lp-meal-copy">
          <span className="lp-kicker" data-reveal>{t("lp.meal.kicker")}</span>
          <h2 className="lp-h2" data-reveal style={{ "--d": "80ms" }} id="meals-title">
            {t("lp.meal.before")}<span className="lp-serif" style={{ color: "var(--lp-coral-ink)" }}>{t("lp.meal.word")}</span>
          </h2>
          <div className="lp-meal-points">
            {[[MoonStar, "off"], [UserPlus, "guest"], [Receipt, "bazar"]].map(([I, k], i) => (
              <div key={k} data-reveal style={{ "--d": `${150 + i * 90}ms` }}>
                <i><I /></i>
                <div><b>{t(`lp.meal.points.${k}.title`)}</b><span>{t(`lp.meal.points.${k}.text`)}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChatShowcase() {
  const t = useT();
  return (
    <section className="lp-chatsec" id="chat" aria-labelledby="chat-title">
      <div className="lp-wrap lp-chat-grid">
        <div>
          <span className="lp-kicker" data-reveal>{t("lp.chat.kicker")}</span>
          <h2 className="lp-h2" id="chat-title" data-reveal style={{ "--d": "80ms" }}>
            {t("lp.chat.before")}<span className="lp-serif lp-brandword">{t("lp.chat.word")}</span>
          </h2>
          <p className="lp-lead" data-reveal style={{ "--d": "160ms" }}>{t("lp.chat.lead")}</p>
          <div className="lp-hero-meta" data-reveal style={{ "--d": "240ms" }}>
            <span><Zap /> {t("lp.chat.realtime")}</span>
            <span><Lock /> {t("lp.chat.membersOnly")}</span>
            <span><CircleCheck /> {t("lp.chat.receipts")}</span>
          </div>
        </div>
        <div className="lp-phones" data-reveal="fade" aria-hidden>
          <div className="lp-phone">
            <div className="lp-phone-screen">
              <div className="lp-phone-head">
                <span className="lp-mark" style={{ width: 34, height: 34, borderRadius: 10, fontSize: 11, fontWeight: 700 }}>GV</span>
                <div><b>{t("homeChat.title", { home: t("lp.chat.demoShort") })}</b><small><i />{t("lp.chat.online", { n: 4 })}</small></div>
              </div>
              <div className="lp-phone-body">
                <div className="who lp-msg-in" style={{ transitionDelay: "200ms" }}>{t("lp.people.karim")}</div>
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "200ms" }}>{t("lp.chat.m1")}</div>
                <div className="who lp-msg-in" style={{ transitionDelay: "550ms" }}>{t("lp.people.sakib")}</div>
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "550ms" }}>{t("lp.bubble")}</div>
                <div className="lp-bubble me lp-msg-in" style={{ transitionDelay: "900ms" }}>{t("lp.chat.m3")}</div>
                <div className="seen lp-msg-in" style={{ transitionDelay: "1100ms" }}>{t("chat.seenBy", { n: 3 })}</div>
                <div className="lp-typing lp-msg-in" style={{ transitionDelay: "1300ms" }}><i /><i /><i /></div>
              </div>
              <div className="lp-phone-compose">{t("lp.chat.compose", { name: t("lp.chat.demoShort") })}<span><Send /></span></div>
            </div>
          </div>
          <div className="lp-phone">
            <div className="lp-phone-screen">
              <div className="lp-phone-head">
                <Avatar user={{ name: t("lp.peopleFull.ayesha") }} size={34} />
                <div><b>{t("lp.peopleFull.ayesha")}</b><small><i />{t("lp.chat.onlineFriend")}</small></div>
              </div>
              <div className="lp-phone-body">
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "400ms" }}>{t("lp.chat.f1")}</div>
                <div className="lp-bubble me lp-msg-in" style={{ transitionDelay: "800ms" }}>{t("lp.chat.f2")}</div>
                <div className="lp-bubble lp-msg-in" style={{ transitionDelay: "1200ms" }}>{t("lp.chat.f3")}</div>
                <div className="seen lp-msg-in" style={{ transitionDelay: "1400ms" }}>{t("chat.seen")}</div>
              </div>
              <div className="lp-phone-compose">{t("lp.chat.compose", { name: t("lp.people.ayesha") })}<span><Send /></span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const t = useT();
  return (
    <section className="lp-cta" aria-labelledby="cta-title">
      <div className="lp-cta-box" data-reveal="scale">
        <h2 id="cta-title">{t("lp.cta.before")}<span className="lp-serif">{t("lp.cta.word")}</span></h2>
        <p>{t("lp.cta.text")}</p>
        <div className="lp-hero-ctas">
          <Link to="/register" className="lp-btn lp-btn-primary">{t("lp.cta.create")} <ArrowRight /></Link>
          <Link to="/login" className="lp-btn lp-btn-ghost">{t("lp.cta.invite")}</Link>
        </div>
      </div>
    </section>
  );
}

const anchor = (id, label) => (
  <a href={`/#${id}`} onClick={(e) => scrollToId(e, id)}>{label}</a>
);

export function Footer() {
  const t = useT();
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-foot-grid">
          <div className="lp-foot-brand">
            <Logo />
            <p>{t("lp.footer.tagline")}</p>
          </div>
          <div className="lp-foot-col">
            <h4>{t("lp.footer.product")}</h4>
            {anchor("features", t("landing.links.features"))}
            {anchor("how", t("landing.links.how"))}
            {anchor("finance", t("landing.links.finance"))}
            {anchor("meals", t("nav.meals"))}
            {anchor("chat", t("mobileNav.chat"))}
          </div>
          <div className="lp-foot-col">
            <h4>{t("lp.footer.company")}</h4>
            {anchor("about", t("landing.links.about"))}
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">{t("lp.footer.contact")}</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">{t("lp.footer.source")}</a>
          </div>
          <div className="lp-foot-col">
            <h4>{t("lp.footer.legal")}</h4>
            <Link to="/privacy">{t("lp.footer.privacy")}</Link>
            <Link to="/terms">{t("lp.footer.terms")}</Link>
          </div>
          <div className="lp-foot-col">
            <h4>{t("lp.footer.account")}</h4>
            <Link to="/register">{t("auth.register.submit")}</Link>
            <Link to="/login">{t("landing.logIn")}</Link>
            <Link to="/join">{t("shell.joinCode")}</Link>
          </div>
        </div>
        <div className="lp-foot-word" aria-hidden>BachelorMate</div>
        <div className="lp-foot-bottom">
          <span>{t("lp.footer.copyright", { year: num(new Date().getFullYear()).replace(/[,،]/g, "") })}</span>
          <div className="lp-social">
            <a className="lp-iconbtn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label={t("lp.footer.github")}><GithubIcon /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
