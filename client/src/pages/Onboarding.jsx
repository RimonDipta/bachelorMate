import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, House, LogIn, PartyPopper, Copy, Link2, Send, Check } from "lucide-react";
import { api } from "../lib/api";
import { Alert, Button, Card, Field, Input, Select, Switch, SettingRow } from "../components/ui";
import { HomeBasicsFields, MealTypesEditor, RulesEditor } from "../components/HomeForms";
import { useToast } from "../context/ToastContext";

const STEPS = ["Welcome", "Home", "Rules", "Meals", "Invite", "Done"];
const DEFAULT_MEALS = [
  { key: "breakfast", label: "Breakfast", weight: 0.5, enabled: true },
  { key: "lunch", label: "Lunch", weight: 1, enabled: true },
  { key: "dinner", label: "Dinner", weight: 1, enabled: true },
];

function InviteStep({ home }) {
  const toast = useToast();
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success("Copied"));
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
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <div className="stack">
      <Field label="Home code" hint="Roommates can enter this code from “Join a home”.">
        <div className="code-box">
          <span className="big">{home.code}</span>
          <Button size="sm" icon={Copy} onClick={() => copy(home.code)}>Copy</Button>
        </div>
      </Field>
      <Field label="Invitation link" hint="Valid for 7 days. Anyone with the link can request to join.">
        {link ? (
          <div className="code-box"><span className="truncate">{link}</span><Button size="sm" icon={Copy} onClick={() => copy(link)}>Copy</Button></div>
        ) : (
          <Button icon={Link2} onClick={makeLink} loading={busy}>Generate link</Button>
        )}
      </Field>
      <form onSubmit={sendEmail}>
        <Field label="Invite by email">
          <div className="row">
            <Input type="email" placeholder="roommate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" icon={Send} disabled={!email.includes("@")}>Send</Button>
          </div>
        </Field>
      </form>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
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
    mealTypes: DEFAULT_MEALS, mealOffCutoff: "22:00", guestMealPricing: "meal_rate",
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
    toast.success(`${home.name} is ready`);
    navigate(`/h/${home._id}`);
  };

  const nameError = v.name.trim().length < 2 ? "Give your home a name (2+ characters)" : "";

  return (
    <main className="content content-narrow">
      <div className="stack-lg" style={{ paddingTop: 8 }}>
        <div className="stack" style={{ gap: 10 }}>
          <div className="row between">
            <span className="text-xs muted">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
            {step > 0 && step < 4 && <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Back</Button>}
          </div>
          <div className="steps" aria-hidden>{STEPS.map((s, i) => <span key={s} className={i <= step ? "done" : ""} />)}</div>
        </div>

        {step === 0 && (
          <div className="stack-lg">
            <div>
              <h1>Welcome to BachelorMate</h1>
              <p className="muted" style={{ marginTop: 6 }}>Let's set up your shared home. You can change everything later.</p>
            </div>
            <div className="grid-2">
              <button className="card card-link card-pad" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setStep(1)}>
                <div className="feature-icon"><House /></div>
                <h3>Create a new home</h3>
                <p className="muted text-sm" style={{ marginTop: 4 }}>You'll be the Admin. Set rules, meals and invite your roommates.</p>
              </button>
              <Link to="/join" className="card card-link card-pad">
                <div className="feature-icon"><LogIn /></div>
                <h3>Join an existing home</h3>
                <p className="muted text-sm" style={{ marginTop: 4 }}>Use an invitation link or the home code someone shared with you.</p>
              </Link>
            </div>
          </div>
        )}

        {step === 1 && (
          <Card pad title="Tell us about your home">
            <div className="stack">
              <HomeBasicsFields values={v} set={set} errors={{ name: v.name && nameError }} />
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="primary" iconRight={ArrowRight} disabled={Boolean(nameError)} onClick={() => setStep(2)}>Continue</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card pad title="House rules & policies">
            <div className="stack">
              <p className="muted text-sm">New members read and accept these before joining.</p>
              <RulesEditor value={v.rules} onChange={(r) => set("rules", r)} />
              <div className="form-grid">
                <Field label="Departure notice (days)" hint="How early members must request to leave.">
                  <Input type="number" min={0} max={180} value={v.departureNoticeDays} onChange={(e) => set("departureNoticeDays", Math.max(0, Math.min(180, Number(e.target.value) || 0)))} />
                </Field>
                <Field label="Payment due day" hint="Day of the month dues should be paid by.">
                  <Input type="number" min={1} max={28} value={v.paymentDueDay} onChange={(e) => set("paymentDueDay", Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />
                </Field>
              </div>
              <SettingRow title="Approve new members" description="People joining with a code or link wait for an Admin or Manager.">
                <Switch checked={v.requireApproval} onChange={(x) => set("requireApproval", x)} label="Require approval" />
              </SettingRow>
              <div className="row between">
                <Button variant="ghost" onClick={() => setStep(3)}>Skip for now</Button>
                <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep(3)}>Continue</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card pad title="Meal settings">
            <div className="stack">
              <MealTypesEditor value={v.mealTypes} onChange={(m) => set("mealTypes", m)} />
              <div className="form-grid">
                <Field label="Meal-off deadline" hint="Requests for a day must arrive before this time on the previous day.">
                  <Input type="time" value={v.mealOffCutoff} onChange={(e) => set("mealOffCutoff", e.target.value)} />
                </Field>
                <Field label="Guest meals are charged">
                  <Select value={v.guestMealPricing} onChange={(e) => set("guestMealPricing", e.target.value)} options={[{ value: "meal_rate", label: "At the meal rate (to the host)" }, { value: "fixed", label: "At a fixed rate (set later)" }]} />
                </Field>
              </div>
              {error && <Alert tone="danger">{error}</Alert>}
              <div className="row between">
                <Button variant="ghost" onClick={() => { set("mealTypes", DEFAULT_MEALS); create({ mealTypes: DEFAULT_MEALS }); }} disabled={creating}>Use defaults</Button>
                <Button variant="primary" icon={Check} loading={creating} onClick={() => create()}>Create home</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 4 && home && (
          <Card pad title="Invite your roommates">
            <div className="stack">
              <InviteStep home={home} />
              <div className="row between">
                <Button variant="ghost" onClick={() => setStep(5)}>Skip, I'll invite later</Button>
                <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep(5)}>Continue</Button>
              </div>
            </div>
          </Card>
        )}

        {step === 5 && home && (
          <Card pad>
            <div className="empty">
              <div className="feature-icon"><PartyPopper /></div>
              <h1 style={{ fontSize: "var(--text-xl)" }}>{home.name} is ready</h1>
              <p>Next: create a meal period, record your first bazar, and start chatting with your home.</p>
              <Button variant="primary" iconRight={ArrowRight} onClick={finish} style={{ marginTop: 8 }}>Go to dashboard</Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
