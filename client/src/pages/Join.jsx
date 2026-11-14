import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock, House, ScrollText, Users, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, LoadingBlock } from "../components/ui";
import { HOME_TYPES, initials } from "../lib/format";
import { useT } from "../i18n/I18nProvider";

export function JoinDetails({ home, profile, setProfile, accepted, setAccepted }) {
  const t = useT();
  return (
    <div className="stack">
      <div className="home-tile" style={{ padding: 0 }}>
        <div className="home-mark">{initials(home.name)}</div>
        <div className="grow">
          <div className="strong">{home.name}</div>
          <div className="text-xs muted">{HOME_TYPES[home.type]}{home.address ? ` · ${home.address}` : ""}</div>
        </div>
        {home.memberCount > 0 && <Badge icon={Users}>{t("homes.members", { count: home.memberCount })}</Badge>}
      </div>
      {home.description && <p className="text-sm muted">{home.description}</p>}
      <div className="card">
        <div className="card-head"><h3 className="row"><ScrollText size={15} /> {t("homeSettings.houseRules")}</h3></div>
        <div className="card-body stack">
          {home.rules?.length ? <ol className="rules-list">{home.rules.map((r) => <li key={r}>{r}</li>)}</ol> : <p className="text-sm muted">{t("join.noRules")}</p>}
          {[[t("nav.meals"), home.mealPolicy], [t("meals.guests"), home.guestPolicy], [t("join.payments"), home.paymentPolicy]].filter(([, text]) => text).map(([l, text]) => (
            <div key={l}><div className="text-xs strong">{l}</div><p className="text-sm muted">{text}</p></div>
          ))}
          <p className="hint">{t("join.notice", { count: home.departureNoticeDays })}</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label={t("members.roomBed")} optional><Input value={profile.room} maxLength={40} onChange={(e) => setProfile({ ...profile, room: e.target.value })} /></Field>
        <Field label={t("settings.profile.phone")} optional><Input type="tel" value={profile.phone} maxLength={30} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
        <Field label={t("members.emergency")} optional className="full" hint={t("join.emergencyHint")}><Input value={profile.emergencyContact} maxLength={120} placeholder={t("join.emergencyPlaceholder")} onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })} /></Field>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>{t("join.agree", { home: home.name })}</span>
      </label>
    </div>
  );
}

export default function Join() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const qc = useQueryClient();
  const [code, setCode] = useState(params.get("code") || "");
  const [submittedCode, setSubmittedCode] = useState(params.get("code") || "");
  const [profile, setProfile] = useState({ room: "", phone: "", emergencyContact: "" });
  const [accepted, setAccepted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const target = token ? { token } : submittedCode ? { code: submittedCode } : null;

  const { data, isLoading, error: previewError } = useQuery({
    queryKey: ["join-preview", target],
    queryFn: () => api.get("/join/preview", target),
    enabled: Boolean(target),
    retry: false,
  });

  const join = async () => {
    setJoining(true);
    setError("");
    try {
      const r = await api.post("/join", { ...target, rulesAccepted: true, ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v.trim())) });
      await qc.invalidateQueries({ queryKey: ["homes"] });
      if (r.status === "active") navigate(`/h/${r.homeId}`);
      else setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setJoining(false);
    }
  };

  const home = data?.home;
  return (
    <main className="content content-narrow">
      <div className="stack-lg">
        <div>
          <h1>{t("homes.join")}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{t("join.subtitle")}</p>
        </div>
        {result ? (
          <Card>
            <EmptyState icon={Clock} title={t("join.requestSent")} description={t("join.requestSentHint", { home: home?.name })} action={<Link to="/homes" className="btn btn-primary">{t("join.backHomes")}</Link>} />
          </Card>
        ) : !target ? (
          <Card pad>
            <form className="stack" onSubmit={(e) => { e.preventDefault(); setSubmittedCode(code.trim().toUpperCase()); }}>
              <Field label={t("invites.homeCode")} hint={t("join.codeHint")}>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} placeholder={t("join.codePlaceholder")} style={{ letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }} autoFocus />
              </Field>
              <Button type="submit" variant="primary" iconRight={ArrowRight} disabled={code.trim().length < 6}>{t("join.find")}</Button>
            </form>
          </Card>
        ) : isLoading ? (
          <Card><LoadingBlock rows={3} /></Card>
        ) : previewError ? (
          <Card>
            <EmptyState icon={AlertCircle} title={t("join.cantUse")} description={previewError.message} action={!token && <Button onClick={() => setSubmittedCode("")}>{t("join.tryAnother")}</Button>} />
          </Card>
        ) : home?.myStatus === "active" ? (
          <Card><EmptyState icon={House} title={t("join.already", { home: home.name })} action={<Link className="btn btn-primary" to={`/h/${home._id}`}>{t("join.open")}</Link>} /></Card>
        ) : home?.myStatus === "pending" ? (
          <Card><EmptyState icon={Clock} title={t("homes.waiting")} description={t("join.pending", { home: home.name })} /></Card>
        ) : (
          <Card pad footer={
            <div className="row between wrap">
              <span className="text-xs muted">{data.requiresApproval ? t("join.willApprove") : t("join.immediately")}</span>
              <Button variant="primary" onClick={join} loading={joining} disabled={!accepted}>{data.requiresApproval ? t("join.request") : t("join.joinHome")}</Button>
            </div>
          }>
            {error && <Alert tone="danger" style={{ marginBottom: 12 }}>{error}</Alert>}
            <JoinDetails home={home} profile={profile} setProfile={setProfile} accepted={accepted} setAccepted={setAccepted} />
          </Card>
        )}
      </div>
    </main>
  );
}
