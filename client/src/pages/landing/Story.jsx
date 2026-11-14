import { Crown, Check, Clock, Send } from "lucide-react";
import { Avatar } from "../../components/ui";
import { useT } from "../../i18n/I18nProvider";
import { money, num } from "../../lib/format";

const taka = (minor) => money(minor, "BDT");
const takaWhole = (minor) => money(minor, "BDT").replace(/[.][0০]{2}(?=\D*$)/, "");

export function Statement() {
  const t = useT();
  return (
    <section className="lp-statement" id="about" aria-labelledby="about-title">
      <div className="lp-wrap">
        <span className="lp-kicker" data-reveal>{t("lp.statement.kicker")}</span>
        <p className="big" id="about-title" data-reveal style={{ "--d": "80ms" }}>
          {t("lp.statement.before")}<span className="lp-serif">{t("lp.statement.word")}</span>{t("lp.statement.after")}<span className="dim">{t("lp.statement.dim")}</span>
        </p>
        <div className="lp-principles">
          {["fair", "honest", "roles"].map((k, i) => (
            <div key={k} data-reveal style={{ "--d": `${i * 100}ms` }}>
              <i>{num(i + 1).padStart(2, num(0))}</i>
              <b>{t(`lp.principles.${k}.title`)}</b>
              <span>{t(`lp.principles.${k}.text`)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const MEAL_ROWS = [
  ["rahim", ["on", "on", "guest"]],
  ["karim", ["on", "off", "on"]],
  ["sakib", ["on", "on", "on"]],
  ["tanvir", ["off", "on", "on"]],
  ["nayeem", ["off", "on", "on"]],
];

export function Features() {
  const t = useT();
  const name = (k) => t(`lp.people.${k}`);
  const full = (k) => t(`lp.peopleFull.${k}`);
  return (
    <section className="lp-features" id="features" aria-labelledby="features-title">
      <div className="lp-wrap">
        <div className="lp-sechead">
          <div>
            <span className="lp-kicker" data-reveal>{t("lp.features.kicker")}</span>
            <h2 className="lp-h2" id="features-title" data-reveal style={{ "--d": "80ms" }}>
              {t("lp.features.titleBefore")}<span className="lp-serif lp-brandword">{t("lp.features.titleWord")}</span>{t("lp.features.titleAfter")}
            </h2>
          </div>
          <p className="lp-lead" data-reveal style={{ "--d": "160ms" }}>{t("lp.features.lead")}</p>
        </div>

        <div className="lp-bento">
          <article className="lp-card c-home" data-reveal>
            <div>
              <span className="lp-tag">{t("lp.features.home.tag")}</span>
              <h3 style={{ marginTop: 10 }}>{t("lp.features.home.title")}</h3>
              <p>{t("lp.features.home.text")}</p>
            </div>
            <div className="lp-card-viz v-homes" aria-hidden>
              <div className="v-homelist">
                <div className="on"><i>GV</i>{t("lp.demoHome")}<small>{t("homes.members", { count: 6 })}</small></div>
                <div><i>DH</i>{t("lp.features.home.flat")}<small>{t("homes.members", { count: 3 })}</small></div>
                <div><i>OH</i>{t("lp.features.home.hostel")}<small>{t("requests.filter.pending")}</small></div>
              </div>
              <div className="v-code">
                <small>{t("invites.homeCode")}</small>
                <b>K7M2QX9A</b>
                <span className="lp-chip lp-chip-brand" style={{ justifySelf: "start" }}>{t("lp.features.home.approval")}</span>
              </div>
            </div>
          </article>

          <article className="lp-card c-meal" data-reveal style={{ "--d": "100ms" }}>
            <div>
              <span className="lp-tag">{t("lp.features.meal.tag")}</span>
              <h3 style={{ marginTop: 10 }}>{t("lp.features.meal.title")}</h3>
              <p>{t("lp.features.meal.text")}</p>
            </div>
            <div className="lp-card-viz" aria-hidden>
              <div className="v-mealgrid">
                <span />
                <span>{t("lp.features.meal.b")}</span><span>{t("lp.features.meal.l")}</span><span>{t("lp.features.meal.d")}</span>
                {MEAL_ROWS.map(([k, cells]) => (
                  <FragmentRow key={k} name={name(k)} cells={cells} />
                ))}
              </div>
              <div className="v-mealfoot"><span>{t("lp.features.meal.rate")}</span><b className="num">{taka(6244)}</b></div>
            </div>
          </article>

          <article className="lp-card c-exp" data-reveal style={{ "--d": "60ms" }}>
            <div>
              <span className="lp-tag">{t("lp.features.exp.tag")}</span>
              <h3 style={{ marginTop: 10 }}>{t("lp.features.exp.title")}</h3>
            </div>
            <div className="lp-card-viz v-split" aria-hidden>
              <div className="v-split-total"><span>{t("lp.features.exp.electricity")}</span><b className="num">{taka(287550)}</b></div>
              <div className="v-splitbar">{[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ "--k": k }} />)}</div>
              <div className="v-split-rows">
                <span>{name("rahim")} <b>{taka(57510)}</b></span><span>{name("karim")} <b>{taka(57510)}</b></span>
                <span>{name("sakib")} <b>{taka(57510)}</b></span><span>{t("lp.features.exp.more", { n: 2 })} <b>{taka(57510)}</b></span>
              </div>
            </div>
          </article>

          <article className="lp-card c-mem" data-reveal style={{ "--d": "120ms" }}>
            <div>
              <span className="lp-tag">{t("lp.features.mem.tag")}</span>
              <h3 style={{ marginTop: 10 }}>{t("lp.features.mem.title")}</h3>
            </div>
            <div className="lp-card-viz v-members" aria-hidden>
              {[["rahim", "admin", "lp-chip-brand", Crown], ["karim", "manager", "lp-chip-mute"], ["sakib", "meal_manager", "lp-chip-coral"], ["tanvir", "member", "lp-chip-mute"]].map(([k, r, c, I]) => (
                <div key={k}><Avatar user={{ name: full(k) }} size={26} /><span>{full(k)}</span><span className={`lp-chip ${c}`} style={{ flex: "none" }}>{I && <I size={11} />}{t(`roles.${r}`)}</span></div>
              ))}
            </div>
          </article>

          <article className="lp-card c-chat" data-reveal style={{ "--d": "60ms" }}>
            <div>
              <span className="lp-tag">{t("lp.features.chat.tag")}</span>
              <h3 style={{ marginTop: 10 }}>{t("lp.features.chat.title")}</h3>
              <p>{t("lp.features.chat.text")}</p>
            </div>
            <div className="lp-card-viz v-chat" aria-hidden>
              <div className="row"><Avatar user={{ name: full("sakib") }} size={24} /><div className="lp-bubble">{t("lp.features.chat.msg1")}</div></div>
              <div className="row" style={{ justifyContent: "flex-end" }}><div className="lp-bubble me">{t("lp.features.chat.msg2")}</div></div>
              <div className="row"><Avatar user={{ name: full("tanvir") }} size={24} /><div className="lp-typing"><i /><i /><i /></div></div>
            </div>
          </article>

          <article className="lp-card c-pay" data-reveal style={{ "--d": "120ms" }}>
            <div>
              <span className="lp-tag">{t("lp.features.pay.tag")}</span>
              <h3 style={{ marginTop: 10 }}>{t("lp.features.pay.title")}</h3>
              <p>{t("lp.features.pay.text")}</p>
            </div>
            <div className="lp-card-viz v-pay" aria-hidden>
              <div><Avatar user={{ name: full("karim") }} size={26} /><span>{name("karim")} · {t("tx.method.bkash")}</span><b>{takaWhole(125000)}</b><span className="lp-chip lp-chip-lime" style={{ flex: "none" }}><Check size={11} />{t("lp.features.pay.confirmed")}</span></div>
              <div><Avatar user={{ name: full("nayeem") }} size={26} /><span>{name("nayeem")} · {t("tx.method.cash")}</span><b>{takaWhole(300000)}</b><span className="lp-chip lp-chip-coral" style={{ flex: "none" }}><Clock size={11} />{t("requests.filter.pending")}</span></div>
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
        <span key={i} className={`v-dot ${c}`}>{c === "guest" ? `+${num(1)}` : c === "on" ? num(1) : ""}</span>
      ))}
    </>
  );
}

export function HowItWorks() {
  const t = useT();
  return (
    <section className="lp-how" id="how" aria-labelledby="how-title">
      <div className="lp-wrap">
        <span className="lp-kicker" data-reveal>{t("landing.links.how")}</span>
        <h2 className="lp-h2" id="how-title" data-reveal style={{ "--d": "80ms" }}>
          {t("lp.how.line1")}<br />{t("lp.how.before")}<span className="lp-serif lp-brandword">{t("lp.how.word")}</span>{t("lp.how.after")}
        </h2>
        <div className="lp-steps" data-reveal="fade">
          <div className="lp-step" data-reveal style={{ "--d": "150ms" }}>
            <span className="lp-step-n">{num(0)}{num(1)}</span>
            <h3>{t("lp.how.s1.title")}</h3>
            <p>{t("lp.how.s1.text")}</p>
            <div className="lp-step-ui" aria-hidden>
              <small style={{ color: "var(--lp-ink-3)" }}>{t("homeForms.homeName")}</small>
              <div className="lp-input-fake">{t("lp.demoHome")}</div>
            </div>
          </div>
          <div className="lp-step" data-reveal style={{ "--d": "300ms" }}>
            <span className="lp-step-n">{num(0)}{num(2)}</span>
            <h3>{t("lp.how.s2.title")}</h3>
            <p>{t("lp.how.s2.text")}</p>
            <div className="lp-step-ui" aria-hidden>
              <div className="r"><span style={{ display: "flex" }}>{["karim", "sakib", "tanvir"].map((k, i) => <span key={k} style={{ marginLeft: i ? -8 : 0 }}><Avatar user={{ name: t(`lp.peopleFull.${k}`) }} size={26} /></span>)}</span><span className="lp-chip lp-chip-brand"><Send size={11} />{t("lp.how.invited", { n: 3 })}</span></div>
            </div>
          </div>
          <div className="lp-step" data-reveal style={{ "--d": "450ms" }}>
            <span className="lp-step-n">{num(0)}{num(3)}</span>
            <h3>{t("lp.how.s3.title")}</h3>
            <p>{t("lp.how.s3.text")}</p>
            <div className="lp-step-ui" aria-hidden>
              <div className="r"><span>{t("lp.how.yourBalance")}</span><b className="lp-pos num">{money(125000, "BDT", { sign: true })}</b></div>
              <div className="r"><span style={{ color: "var(--lp-ink-3)" }}>{t("lp.how.advanceCredit")}</span><span className="lp-chip lp-chip-lime">{t("finance.settled")}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
