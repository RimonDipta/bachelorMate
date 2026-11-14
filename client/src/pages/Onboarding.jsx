import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, House, LogIn, PartyPopper, Copy, Link2, Send, Check } from "lucide-react";
import { api } from "../lib/api";
import { Alert, Button, Card, Field, Input, Select, Switch, SettingRow } from "../components/ui";
import { HomeBasicsFields, MealTypesEditor, RulesEditor } from "../components/HomeForms";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n/I18nProvider";
import { translate } from "../i18n";

const STEPS = ["welcome", "home", "rules", "meals", "invite", "done"];
// Named in the creator's language; the admin can rename them.
const defaultMeals = () => [
  { key: "breakfast", label: translate("mealTypes.breakfast"), weight: 0.5, enabled: true },
  { key: "lunch", label: translate("mealTypes.lunch"), weight: 1, enabled: true },
  { key: "dinner", label: translate("mealTypes.dinner"), weight: 1, enabled: true },
];

function InviteStep({ home }) {
  const toast = useToast();
  const t = useT();
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success(t("invites.copied")));
  const makeLink = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/homes/${home._id}/invitations`, { kind: "link", expiresInDays: 7 });
      setLink(r.url);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  const sendEmail = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/homes/${home._id}/invitations`, { kind: "direct", email: email.trim() });
      toast.success(t("listings.invitedToast", { name: email }));
      setEmail("");
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <div className="stack">
      <Field label={t("invites.homeCode")} hint={t("onboarding.codeHint")}>
        <div className="code-box">
          <span className="big">{home.code}</span>
          <Button size="sm" icon={Copy} onClick={() => copy(home.code)}>{t("invites.copy")}</Button>
        </div>
      </Field>
      <Field label={t("onboarding.link")} hint={t("onboarding.linkHint")}>
        {link ? (
          <div className="code-box"><span className="truncate">{link}</span><Button size="sm" icon={Copy} onClick={() => copy(link)}>{t("invites.copy")}</Button></div>
        ) : (
          <Button icon={Link2} onClick={makeLink} loading={busy}>{t("onboarding.generate")}</Button>
        )}
      </Field>
      <form onSubmit={sendEmail}>
        <Field label={t("onboarding.byEmail")}>
          <div className="row">
            <Input type="email" placeholder="roommate@example.com" aria-label={t("onboarding.byEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" icon={Send} disabled={!email.includes("@")}>{t("invites.send")}</Button>
          </div>
        </Field>
      </form>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const t = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [home, setHome] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [v, setV] = useState({
    name: "", type: "bachelor_mess", address: "", description: "", currency: "BDT",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka",
    rules: [], departureNoticeDays: 15, paymentDueDay: 10, requireApproval: true,
    mealTypes: defaultMeals(), mealOffCutoff: "22:00", guestMealPricing: "meal_rate",
  });
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  const create = async (overrides = {}) => {
    setCreating(true);
    setError("");
    try {
      const { name, type, address, description, currency, timezone, ...settings } = { ...v, ...overrides };
      const r = await api.post("/homes", { name: name.trim(), type, address: address || undefined, description: description || undefined, currency, timezone, settings });
      setHome(r.home);
      qc.invalidateQueries({ queryKey: ["homes"] });
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const finish = async () => {
    await api.post(`/homes/${home._id}/onboarding/complete`).catch(() => {});
    qc.invalidateQueries({ queryKey: ["home", home._id] });
    toast.success(t("onboarding.ready", { home: home.name }));
    navigate(`/h/${home._id}`);
  };

  const nameError = v.name.trim().length < 2 ? t("onboarding.nameError") : "";

  return (
    <main className="content content-narrow">
      <div className="stack-lg" style={{ paddingTop: 8 }}>
        <div className="stack" style={{ gap: 10 }}>
          <div className="row between">
            <span className="text-xs muted">{t("onboarding.step", { n: step + 1, total: STEPS.length, name: t(`onboarding.steps.${STEPS[step]}`) })}</span>
            {step > 0 && step < 4 && <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>{t("onboarding.back")}</Button>}
          </div>
          <div className="steps" aria-hidden>{STEPS.map((s, i) => <span key={s} className={i <= step ? "done" : ""} />)}</div>
        </div>

        {step === 0 && (
          <div className="stack-lg">
            <div>
              <h1>{t("onboarding.welcome")}</h1>
              <p className="muted" style={{ marginTop: 6 }}>{t("onboarding.welcomeHint")}</p>
            </div>
            <div className="grid-2">
              <button className="card card-link card-pad" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setStep(1)}>
                <div className="feature-icon"><House /></div>
                <h3>{t("onboarding.createNew")}</h3>
                <p className="muted text-sm" style={{ marginTop: 4 }}>{t("onboarding.createNewHint")}</p>
              </button>
              <Link to="/join" className="card card-link card-pad">
                <div className="feature-icon"><LogIn /></div>
                <h3>{t("onboarding.joinExisting")}</h3>
                <p className="muted text-sm" style={{ marginTop: 4 }}>{t("onboarding.joinExistingHint")}</p>
              </Link>
            </div>
          </div>
        )}

        {step === 1 && (
          <Card pad title={t("onboarding.aboutHome")}>
            <div className="stack">
              <HomeBasicsFields values={v} set={set} errors={{ name: v.name && nameError }} />
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="primary" iconRight={ArrowRight} disabled={Boolean(nameError)} onClick={() => setStep(2)}>{t("common.continue")}</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card pad title={t("onboarding.rulesTitle")}>
            <div className="stack">
              <p className="muted text-sm">{t("onboarding.rulesHint")}</p>
              <RulesEditor value={v.rules} onChange={(r) => set("rules", r)} />
              <div className="form-grid">
                <Field label={t("homeSettings.noticeDays")} hint={t("onboarding.noticeHint")}>
                  <Input type="number" min={0} max={180} value={v.departureNoticeDays} onChange={(e) => set("departureNoticeDays", Math.max(0, Math.min(180, Number(e.target.value) || 0)))} />
                </Field>
                <Field label={t("homeSettings.dueDay")} hint={t("onboarding.dueHint")}>
                  <Input type="number" min={1} max={28} value={v.paymentDueDay} onChange={(e) => set("paymentDueDay", Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />
                </Field>
              </div>
              <SettingRow title={t("homeSettings.approveCode")} description={t("homeSettings.approveCodeHint")}>
                <Switch checked={v.requireApproval} onChange={(x) => set("requireApproval", x)} label={t("homeSettings.approveCode")} />
              </SettingRow>
              <div className="row between">
                <Button variant="ghost" onClick={() => setStep(3)}>{t("onboarding.skip")}</Button>
                <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep(3)}>{t("common.continue")}</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card pad title={t("onboarding.mealSettings")}>
            <div className="stack">
              <MealTypesEditor value={v.mealTypes} onChange={(m) => set("mealTypes", m)} />
              <div className="form-grid">
                <Field label={t("homeSettings.mealOffDeadline")} hint={t("onboarding.deadlineHint")}>
                  <Input type="time" value={v.mealOffCutoff} onChange={(e) => set("mealOffCutoff", e.target.value)} />
                </Field>
                <Field label={t("onboarding.guestCharged")}>
                  <Select value={v.guestMealPricing} onChange={(e) => set("guestMealPricing", e.target.value)} options={[{ value: "meal_rate", label: t("onboarding.atRate") }, { value: "fixed", label: t("onboarding.atFixed") }]} />
                </Field>
              </div>
              {error && <Alert tone="danger">{error}</Alert>}
              <div className="row between">
                <Button variant="ghost" onClick={() => { const d = defaultMeals(); set("mealTypes", d); create({ mealTypes: d }); }} disabled={creating}>{t("onboarding.useDefaults")}</Button>
                <Button variant="primary" icon={Check} loading={creating} onClick={() => create()}>{t("homes.create")}</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 4 && home && (
          <Card pad title={t("setup.invite")}>
            <div className="stack">
              <InviteStep home={home} />
              <div className="row between">
                <Button variant="ghost" onClick={() => setStep(5)}>{t("onboarding.inviteLater")}</Button>
                <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep(5)}>{t("common.continue")}</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 5 && home && (
          <Card pad>
            <div className="empty">
              <div className="feature-icon"><PartyPopper /></div>
              <h1 style={{ fontSize: "var(--text-xl)" }}>{t("onboarding.ready", { home: home.name })}</h1>
              <p>{t("onboarding.next")}</p>
              <Button variant="primary" iconRight={ArrowRight} onClick={finish} style={{ marginTop: 8 }}>{t("onboarding.goDashboard")}</Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
