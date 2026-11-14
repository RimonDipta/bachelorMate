import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, MoonStar, UserPlus, Plane, DoorOpen, Check, X, Inbox, AlertTriangle, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Money, PageHeader, Segmented, Select, StatusBadge, Tabs, Textarea } from "../../components/ui";
import { addDays, fmtDay, localDay, mealTypeLabel, timeAgo } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

const TYPES = { meal_off: MoonStar, guest_meal: UserPlus, absence: Plane, departure: DoorOpen };

const NewRequestModal = (props) => (props.open ? <NewRequestForm {...props} /> : null);

function NewRequestForm({ open, onClose, initialType }) {
  const { homeId, home, currency } = useHome();
  const t = useT();
  const types = home.settings.mealTypes.filter((mt) => mt.enabled);
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
    { invalidate: [["requests", homeId], ["dashboard", homeId], ["meals", homeId]], success: (r) => (r.request.status === "approved" ? t("requests.autoApproved") : t("requests.sent")), onSuccess: onClose }
  );
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const early = type === "departure" && dep && f.startDay && f.startDay < dep.earliestDay;
  const isAdmin = dep?.isAdmin;

  return (
    <FormModal open={open} onClose={onClose} title={t("requests.newTitle")} submitLabel={type === "departure" ? t("requests.requestDeparture") : t("requests.send")} loading={submit.isPending}
      disabled={isAdmin && type === "departure" || (early && !f.exceptionReason?.trim())} onSubmit={() => submit.mutate()}>
      <Segmented label={t("requests.type")} value={type} onChange={setType} items={Object.entries(TYPES).map(([value, icon]) => ({ value, label: t(`requests.types.${value}`), icon }))} />
      {(type === "meal_off" || type === "absence") && <p className="hint">{t("requests.cutoff", { time: home.settings.mealOffCutoff })}{type === "absence" && ` ${t("requests.absenceMeals")}`}</p>}

      {type === "meal_off" && (
        <>
          <div className="form-grid">
            <Field label={t("tx.from")}><Input type="date" min={tomorrow} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
            <Field label={t("tx.to")} optional><Input type="date" min={f.startDay} value={f.endDay} onChange={(e) => set("endDay", e.target.value)} /></Field>
          </div>
          <Field label={t("meals.meals")} hint={t("requests.allMealsHint")}>
            <div className="row wrap" style={{ gap: 14 }}>
              {types.map((mt) => (
                <label key={mt.key} className="checkbox">
                  <input type="checkbox" checked={f.mealTypes?.includes(mt.key) || false} onChange={(e) => set("mealTypes", e.target.checked ? [...f.mealTypes, mt.key] : f.mealTypes.filter((k) => k !== mt.key))} />
                  {mealTypeLabel(mt)}
                </label>
              ))}
            </div>
          </Field>
        </>
      )}
      {type === "guest_meal" && (
        <div className="form-grid">
          <Field label={t("common.date")}><Input type="date" min={localDay()} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
          <Field label={t("homeForms.meal")}><Select value={f.guestMeal} onChange={(e) => set("guestMeal", e.target.value)} options={types.map((mt) => ({ value: mt.key, label: mealTypeLabel(mt) }))} /></Field>
          <Field label={t("requests.guestCount")}><Input type="number" min={1} max={50} value={f.guestCount} onChange={(e) => set("guestCount", e.target.value)} /></Field>
          <Field label={t("requests.guestName")} optional><Input value={f.guestName} maxLength={80} onChange={(e) => set("guestName", e.target.value)} /></Field>
          {home.settings.guestPolicy && <p className="hint full">{home.settings.guestPolicy}</p>}
        </div>
      )}
      {type === "absence" && (
        <div className="form-grid">
          <Field label={t("requests.awayFrom")}><Input type="date" min={tomorrow} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
          <Field label={t("requests.backAfter")}><Input type="date" min={f.startDay} value={f.endDay} onChange={(e) => set("endDay", e.target.value)} /></Field>
        </div>
      )}
      {type === "departure" && dep && (
        <>
          {isAdmin ? (
            <Alert tone="warning" icon={AlertTriangle}>{t("requests.ownerFirst")}</Alert>
          ) : (
            <Alert tone="info" icon={Clock}>{t("requests.noticeBefore")}<b>{t("requests.noticeDays", { count: dep.noticeDays })}</b>{t("requests.noticeMiddle")}<b>{fmtDay(dep.earliestDay, { month: "long", day: "numeric", year: "numeric" })}</b>{t("requests.noticeAfter")}</Alert>
          )}
          <Field label={t("requests.departureDate")}><Input type="date" min={localDay()} value={f.startDay} onChange={(e) => set("startDay", e.target.value)} /></Field>
          {early && (
            <Field label={t("requests.earlyReason")} hint={t("requests.earlyHint")}>
              <Textarea value={f.exceptionReason} maxLength={500} onChange={(e) => set("exceptionReason", e.target.value)} />
            </Field>
          )}
          {dep.balance < 0 && <Alert tone="warning">{t("requests.duesBefore")}<b><Money value={-dep.balance} currency={currency} /></b>{t("requests.duesAfter")}</Alert>}
        </>
      )}
      <Field label={t("requests.note")} optional><Textarea value={f.note} maxLength={500} onChange={(e) => set("note", e.target.value)} /></Field>
    </FormModal>
  );
}

function RequestItem({ r, review, onApprove, onReject, onCancel, mealLabel }) {
  const t = useT();
  const Icon = TYPES[r.type];
  const typeLabel = t(`requests.types.${r.type}`);
  const range = r.endDay && r.endDay !== r.startDay ? `${fmtDay(r.startDay)} → ${fmtDay(r.endDay)}` : fmtDay(r.startDay, { weekday: "short", month: "short", day: "numeric" });
  let detail = range;
  if (r.type === "meal_off") detail += ` · ${r.mealTypes?.length ? r.mealTypes.map(mealLabel).join(", ") : t("requests.allMeals")}`;
  if (r.type === "guest_meal") detail += ` · ${t("requests.guestsFor", { count: r.guestCount, meal: mealLabel(r.mealTypes?.[0]) })}${r.guestName ? ` (${r.guestName})` : ""}`;
  return (
    <div className="list-item" style={{ alignItems: "flex-start" }}>
      {review ? <Avatar user={r.user} size={32} /> : <div className="timeline-dot" style={{ width: 32, height: 32 }}><Icon /></div>}
      <div className="grow col" style={{ gap: 3 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="strong text-sm">{review ? `${r.user?.name} · ${typeLabel}` : typeLabel}</span>
          <StatusBadge status={r.status} />
          {r.isException && <Badge tone="danger">{t("requests.exception")}</Badge>}
        </div>
        <div className="text-sm muted">{detail}</div>
        {r.note && <div className="text-sm" style={{ whiteSpace: "pre-wrap" }}>{r.note}</div>}
        {r.reviewNote && <div className="text-xs muted">{t("requests.reviewer", { note: r.reviewNote })}{r.reviewedBy ? ` — ${r.reviewedBy.name}` : ""}</div>}
        <div className="text-xs subtle">{timeAgo(r.createdAt)}</div>
      </div>
      <div className="row">
        {review && r.status === "pending" && (
          <>
            <Button size="sm" variant="ghost" icon={X} onClick={() => onReject(r)}>{t("requests.decline")}</Button>
            <Button size="sm" variant="primary" icon={Check} onClick={() => onApprove(r)}>{t("requests.approve")}</Button>
          </>
        )}
        {!review && (r.status === "pending" || (r.status === "approved" && r.type === "departure")) && <Button size="sm" variant="ghost" onClick={() => onCancel(r)}>{r.status === "pending" ? t("common.cancel") : t("requests.withdraw")}</Button>}
      </div>
    </div>
  );
}

export default function Requests() {
  const { homeId, home, can } = useHome();
  const t = useT();
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
  const decide = useAction(({ r, action }) => api.post(`/homes/${homeId}/requests/${r._id}/${action}`, { note: note || undefined }), { invalidate: inv, success: (_, v) => (v.action === "approve" ? t("requests.approvedToast") : t("requests.declinedToast")), onSuccess: () => setReviewing(null) });
  const cancel = useAction((r) => api.post(`/homes/${homeId}/requests/${r._id}/cancel`), { invalidate: inv, success: t("requests.cancelledToast") });
  const mealLabel = (k) => mealTypeLabel(home.settings.mealTypes.find((mt) => mt.key === k)) || k;
  const setNew = (v) => setParams(v ? { ...Object.fromEntries(params), new: v } : Object.fromEntries([...params].filter(([k]) => k !== "new")));

  return (
    <>
      <PageHeader title={t("nav.requests")} description={t("requests.desc")} actions={<Button variant="primary" icon={Plus} onClick={() => setNew("meal_off")}>{t("requests.newTitle")}</Button>} />
      {canReview && <Tabs items={[{ value: "mine", label: t("requests.mine") }, { value: "review", label: t("requests.toReview"), count: pending?.requests?.length }]} value={tab} onChange={(v) => { setStatus(v === "review" ? "pending" : "all"); setParams({ tab: v }); }} />}
      <div className="row" style={{ marginBottom: 12 }}>
        <Segmented label={t("common.status")} value={status} onChange={setStatus} items={[{ value: "all", label: t("common.all") }, { value: "pending", label: t("requests.filter.pending") }, { value: "approved", label: t("requests.filter.approved") }, { value: "rejected", label: t("requests.filter.declined") }]} />
      </div>
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.requests.length ? (
          <EmptyState icon={Inbox} title={tab === "review" ? t("requests.nothingToReview") : t("requests.none")} description={tab === "review" ? t("requests.nothingToReviewHint") : t("requests.noneHint")} />
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
      <FormModal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={reviewing?.action === "approve" ? t("requests.approveTitle") : t("requests.declineTitle")} submitLabel={reviewing?.action === "approve" ? t("requests.approve") : t("requests.decline")} danger={reviewing?.action === "reject"} loading={decide.isPending} onSubmit={() => decide.mutate(reviewing)}>
        {reviewing?.r.type === "departure" && reviewing.action === "approve" && <Alert tone="info">{t("requests.accessEnds", { day: fmtDay(reviewing.r.startDay, { month: "long", day: "numeric" }) })}</Alert>}
        {(reviewing?.r.type === "meal_off" || reviewing?.r.type === "absence") && reviewing.action === "approve" && <Alert tone="info">{t("requests.mealsZero")}</Alert>}
        <Field label={t("requests.noteToMember")} optional><Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
      </FormModal>
    </>
  );
}
