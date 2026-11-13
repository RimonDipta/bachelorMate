import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, MoonStar, UserPlus, Plane, DoorOpen, Check, X, Inbox, AlertTriangle, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Money, PageHeader, Segmented, Select, StatusBadge, Tabs, Textarea } from "../../components/ui";
import { addDays, fmtDay, localDay, timeAgo } from "../../lib/format";

const TYPES = {
  meal_off: { label: "Meal off", icon: MoonStar },
  guest_meal: { label: "Guest meal", icon: UserPlus },
  absence: { label: "Absence", icon: Plane },
  departure: { label: "Departure", icon: DoorOpen },
};

const NewRequestModal = (props) => (props.open ? <NewRequestForm {...props} /> : null);

function NewRequestForm({ open, onClose, initialType }) {
  const { homeId, home, currency } = useHome();
  const types = home.settings.mealTypes.filter((t) => t.enabled);
  const tomorrow = addDays(localDay(), 1);
  const [type, setType] = useState(initialType || "meal_off");
  const [f, setF] = useState(() => ({ startDay: tomorrow, endDay: "", mealTypes: [], guestCount: 1, guestMeal: types[types.length - 1]?.key, guestName: "", note: "", exceptionReason: "" }));
  const { data: dep } = useQuery({ queryKey: ["departure-info", homeId], queryFn: () => api.get(`/homes/${homeId}/requests/departure-info`), enabled: open && type === "departure" });
  const submit = useAction(
    () => {
      const body = { type, startDay: f.startDay, note: f.note || undefined };
      if (type === "meal_off") Object.assign(body, { endDay: f.endDay || undefined, mealTypes: f.mealTypes.length ? f.mealTypes : undefined });
      if (type === "absence") body.endDay = f.endDay || f.startDay;
      if (type === "guest_meal") Object.assign(body, { mealTypes: [f.guestMeal], guestCount: Number(f.guestCount), guestName: f.guestName || undefined });
      if (type === "departure" && f.exceptionReason) body.exceptionReason = f.exceptionReason;
      return api.post(`/homes/${homeId}/requests`, body);
    },
    { invalidate: [["requests", homeId], ["dashboard", homeId], ["meals", homeId]], success: (r) => (r.request.status === "approved" ? "Approved automatically" : "Request sent for review"), onSuccess: onClose }
  );
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const early = type === "departure" && dep && f.startDay && f.startDay < dep.earliestDay;
  const isAdmin = dep?.isAdmin;

  return (
    <FormModal open={open} onClose={onClose} title="New request" submitLabel={type === "departure" ? "Request departure" : "Send request"} loading={submit.isPending}
      disabled={isAdmin && type === "departure" || (early && !f.exceptionReason?.trim())} onSubmit={() => submit.mutate()}>
      <Segmented label="Request type" value={type} onChange={setType} items={Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label, icon: t.icon }))} />
      {(type === "meal_off" || type === "absence") && <p className="hint">Requests for a day must be sent before {home.settings.mealOffCutoff} on the previous day.{type === "absence" && " Your meals are turned off for the whole period."}</p>}

      {type === "meal_off" && (
        <>
          <div className="form-grid">
            <Field label="From"><Input type="date" min={tomorrow} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
            <Field label="To" optional><Input type="date" min={f.startDay} value={f.endDay} onChange={(e) => set("endDay", e.target.value)} /></Field>
          </div>
          <Field label="Meals" hint="Leave all unticked to skip every meal.">
            <div className="row wrap" style={{ gap: 14 }}>
              {types.map((t) => (
                <label key={t.key} className="checkbox">
                  <input type="checkbox" checked={f.mealTypes?.includes(t.key) || false} onChange={(e) => set("mealTypes", e.target.checked ? [...f.mealTypes, t.key] : f.mealTypes.filter((k) => k !== t.key))} />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>
        </>
      )}
      {type === "guest_meal" && (
        <div className="form-grid">
          <Field label="Date"><Input type="date" min={localDay()} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
          <Field label="Meal"><Select value={f.guestMeal} onChange={(e) => set("guestMeal", e.target.value)} options={types.map((t) => ({ value: t.key, label: t.label }))} /></Field>
          <Field label="Number of guests"><Input type="number" min={1} max={50} value={f.guestCount} onChange={(e) => set("guestCount", e.target.value)} /></Field>
          <Field label="Guest name" optional><Input value={f.guestName} maxLength={80} onChange={(e) => set("guestName", e.target.value)} /></Field>
          {home.settings.guestPolicy && <p className="hint full">{home.settings.guestPolicy}</p>}
        </div>
      )}
      {type === "absence" && (
        <div className="form-grid">
          <Field label="Away from"><Input type="date" min={tomorrow} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
          <Field label="Back after"><Input type="date" min={f.startDay} value={f.endDay} onChange={(e) => set("endDay", e.target.value)} /></Field>
        </div>
      )}
      {type === "departure" && dep && (
        <>
          {isAdmin ? (
            <Alert tone="warning" icon={AlertTriangle}>As the owner, transfer ownership from the Members page before requesting to leave.</Alert>
          ) : (
            <Alert tone="info" icon={Clock}>This home requires <b>{dep.noticeDays} days</b> notice. The earliest departure date is <b>{fmtDay(dep.earliestDay, { month: "long", day: "numeric", year: "numeric" })}</b>.</Alert>
          )}
          <Field label="Departure date"><Input type="date" min={localDay()} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
          {early && (
            <Field label="Reason for leaving early" hint="Only the Admin can approve an exception to the notice period.">
              <Textarea value={f.exceptionReason} maxLength={500} onChange={(e) => set("exceptionReason", e.target.value)} />
            </Field>
          )}
          {dep.balance < 0 && <Alert tone="warning">You currently have <b><Money value={-dep.balance} currency={currency} /></b> in outstanding dues. Please settle before leaving.</Alert>}
        </>
      )}
      <Field label="Note" optional><Textarea value={f.note} maxLength={500} onChange={(e) => set("note", e.target.value)} /></Field>
    </FormModal>
  );
}

function RequestItem({ r, review, onApprove, onReject, onCancel, mealLabel }) {
  const T = TYPES[r.type];
  const range = r.endDay && r.endDay !== r.startDay ? `${fmtDay(r.startDay)} → ${fmtDay(r.endDay)}` : fmtDay(r.startDay, { weekday: "short", month: "short", day: "numeric" });
  let detail = range;
  if (r.type === "meal_off") detail += ` · ${r.mealTypes?.length ? r.mealTypes.map(mealLabel).join(", ") : "All meals"}`;
  if (r.type === "guest_meal") detail += ` · ${r.guestCount} guest${r.guestCount > 1 ? "s" : ""} for ${mealLabel(r.mealTypes?.[0])}${r.guestName ? ` (${r.guestName})` : ""}`;
  return (
    <div className="list-item" style={{ alignItems: "flex-start" }}>
      {review ? <Avatar user={r.user} size={32} /> : <div className="timeline-dot" style={{ width: 32, height: 32 }}><T.icon /></div>}
      <div className="grow col" style={{ gap: 3 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="strong text-sm">{review ? `${r.user?.name} · ${T.label}` : T.label}</span>
          <StatusBadge status={r.status} />
          {r.isException && <Badge tone="danger">Exception</Badge>}
        </div>
        <div className="text-sm muted">{detail}</div>
        {r.note && <div className="text-sm" style={{ whiteSpace: "pre-wrap" }}>{r.note}</div>}
        {r.reviewNote && <div className="text-xs muted">Reviewer: “{r.reviewNote}”{r.reviewedBy ? ` — ${r.reviewedBy.name}` : ""}</div>}
        <div className="text-xs subtle">{timeAgo(r.createdAt)}</div>
      </div>
      <div className="row">
        {review && r.status === "pending" && (
          <>
            <Button size="sm" variant="ghost" icon={X} onClick={() => onReject(r)}>Decline</Button>
            <Button size="sm" variant="primary" icon={Check} onClick={() => onApprove(r)}>Approve</Button>
          </>
        )}
        {!review && (r.status === "pending" || (r.status === "approved" && r.type === "departure")) && <Button size="sm" variant="ghost" onClick={() => onCancel(r)}>{r.status === "pending" ? "Cancel" : "Withdraw"}</Button>}
      </div>
    </div>
  );
}

export default function Requests() {
  const { homeId, home, can } = useHome();
  const [params, setParams] = useSearchParams();
  const canReview = can("meals.review", "requests.review");
  const tab = canReview && params.get("tab") === "review" ? "review" : "mine";
  const newType = params.get("new");
  const [status, setStatus] = useState(tab === "review" ? "pending" : "all");
  const [reviewing, setReviewing] = useState(null);
  const [note, setNote] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["requests", homeId, tab, status], queryFn: () => api.get(`/homes/${homeId}/requests`, { scope: tab, status }) });
  const { data: pending } = useQuery({ queryKey: ["requests", homeId, "review", "pending"], queryFn: () => api.get(`/homes/${homeId}/requests`, { scope: "review", status: "pending" }), enabled: canReview });

  const inv = [["requests", homeId], ["dashboard", homeId], ["meals", homeId], ["members", homeId]];
  const decide = useAction(({ r, action }) => api.post(`/homes/${homeId}/requests/${r._id}/${action}`, { note: note || undefined }), { invalidate: inv, success: (_, v) => (v.action === "approve" ? "Request approved" : "Request declined"), onSuccess: () => setReviewing(null) });
  const cancel = useAction((r) => api.post(`/homes/${homeId}/requests/${r._id}/cancel`), { invalidate: inv, success: "Request cancelled" });
  const mealLabel = (k) => home.settings.mealTypes.find((t) => t.key === k)?.label || k;
  const setNew = (t) => setParams(t ? { ...Object.fromEntries(params), new: t } : Object.fromEntries([...params].filter(([k]) => k !== "new")));

  return (
    <>
      <PageHeader title="Requests" description="Meal off, guest meals, absences and departures." actions={<Button variant="primary" icon={Plus} onClick={() => setNew("meal_off")}>New request</Button>} />
      {canReview && <Tabs items={[{ value: "mine", label: "My requests" }, { value: "review", label: "To review", count: pending?.requests?.length }]} value={tab} onChange={(t) => { setStatus(t === "review" ? "pending" : "all"); setParams({ tab: t }); }} />}
      <div className="row" style={{ marginBottom: 12 }}>
        <Segmented label="Status" value={status} onChange={setStatus} items={[{ value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Declined" }]} />
      </div>
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.requests.length ? (
          <EmptyState icon={Inbox} title={tab === "review" ? "Nothing to review" : "No requests yet"} description={tab === "review" ? "New requests from members appear here." : "Skip a meal, bring a guest, or plan time away."} />
        ) : (
          <div className="list">
            {data.requests.map((r) => (
              <RequestItem key={r._id} r={r} review={tab === "review"} mealLabel={mealLabel}
                onApprove={(x) => { setNote(""); setReviewing({ r: x, action: "approve" }); }}
                onReject={(x) => { setNote(""); setReviewing({ r: x, action: "reject" }); }}
                onCancel={(x) => cancel.mutate(x)} />
            ))}
          </div>
        )}
      </Card>
      <NewRequestModal open={Boolean(newType)} initialType={TYPES[newType] ? newType : "meal_off"} onClose={() => setNew(null)} />
      <FormModal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={reviewing?.action === "approve" ? "Approve request" : "Decline request"} submitLabel={reviewing?.action === "approve" ? "Approve" : "Decline"} danger={reviewing?.action === "reject"} loading={decide.isPending} onSubmit={() => decide.mutate(reviewing)}>
        {reviewing?.r.type === "departure" && reviewing.action === "approve" && <Alert tone="info">The member's access ends on {fmtDay(reviewing.r.startDay, { month: "long", day: "numeric" })}. Their financial history is kept.</Alert>}
        {(reviewing?.r.type === "meal_off" || reviewing?.r.type === "absence") && reviewing.action === "approve" && <Alert tone="info">Their meals for these days will be set to zero.</Alert>}
        <Field label="Note to member" optional><Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
      </FormModal>
    </>
  );
}
