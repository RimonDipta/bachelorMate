import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock, House, ScrollText, Users, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, LoadingBlock } from "../components/ui";
import { HOME_TYPES, initials, pluralize } from "../lib/format";

export function JoinDetails({ home, profile, setProfile, accepted, setAccepted }) {
  return (
    <div className="stack">
      <div className="home-tile" style={{ padding: 0 }}>
        <div className="home-mark">{initials(home.name)}</div>
        <div className="grow">
          <div className="strong">{home.name}</div>
          <div className="text-xs muted">{HOME_TYPES[home.type]}{home.address ? ` · ${home.address}` : ""}</div>
        </div>
        {home.memberCount > 0 && <Badge icon={Users}>{pluralize(home.memberCount, "member")}</Badge>}
      </div>
      {home.description && <p className="text-sm muted">{home.description}</p>}
      <div className="card">
        <div className="card-head"><h3 className="row"><ScrollText size={15} /> House rules</h3></div>
        <div className="card-body stack">
          {home.rules?.length ? <ol className="rules-list">{home.rules.map((r) => <li key={r}>{r}</li>)}</ol> : <p className="text-sm muted">No written rules yet.</p>}
          {[["Meals", home.mealPolicy], ["Guests", home.guestPolicy], ["Payments", home.paymentPolicy]].filter(([, t]) => t).map(([l, t]) => (
            <div key={l}><div className="text-xs strong">{l}</div><p className="text-sm muted">{t}</p></div>
          ))}
          <p className="hint">Leaving requires {pluralize(home.departureNoticeDays, "day")} notice.</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Room / bed" optional><Input value={profile.room} maxLength={40} onChange={(e) => setProfile({ ...profile, room: e.target.value })} /></Field>
        <Field label="Phone" optional><Input type="tel" value={profile.phone} maxLength={30} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
        <Field label="Emergency contact" optional className="full" hint="Only visible to the home's managers."><Input value={profile.emergencyContact} maxLength={120} placeholder="Name and phone" onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })} /></Field>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>I have read and agree to follow the house rules of {home.name}.</span>
      </label>
    </div>
  );
}

export default function Join() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
          <h1>Join a home</h1>
          <p className="muted" style={{ marginTop: 4 }}>Use the code or link a member shared with you.</p>
        </div>
        {result ? (
          <Card>
            <EmptyState icon={Clock} title="Request sent" description={`An Admin or Manager of ${home?.name} will review your request. We'll notify you once you're in.`} action={<Link to="/homes" className="btn btn-primary">Back to homes</Link>} />
          </Card>
        ) : !target ? (
          <Card pad>
            <form className="stack" onSubmit={(e) => { e.preventDefault(); setSubmittedCode(code.trim().toUpperCase()); }}>
              <Field label="Home code" hint="8 characters, e.g. K7M2QX9A">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} placeholder="ENTER CODE" style={{ letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }} autoFocus />
              </Field>
              <Button type="submit" variant="primary" iconRight={ArrowRight} disabled={code.trim().length < 6}>Find home</Button>
            </form>
          </Card>
        ) : isLoading ? (
          <Card><LoadingBlock rows={3} /></Card>
        ) : previewError ? (
          <Card>
            <EmptyState icon={AlertCircle} title="Can't use this invitation" description={previewError.message} action={!token && <Button onClick={() => setSubmittedCode("")}>Try another code</Button>} />
          </Card>
        ) : home?.myStatus === "active" ? (
          <Card><EmptyState icon={House} title={`You're already in ${home.name}`} action={<Link className="btn btn-primary" to={`/h/${home._id}`}>Open home</Link>} /></Card>
        ) : home?.myStatus === "pending" ? (
          <Card><EmptyState icon={Clock} title="Waiting for approval" description={`Your request to join ${home.name} is pending.`} /></Card>
        ) : (
          <Card pad footer={
            <div className="row between wrap">
              <span className="text-xs muted">{data.requiresApproval ? "An Admin or Manager will approve your request." : "You'll join immediately."}</span>
              <Button variant="primary" onClick={join} loading={joining} disabled={!accepted}>{data.requiresApproval ? "Request to join" : "Join home"}</Button>
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
