import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, LockOpen, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Button, Card, ConfirmDialog, ErrorState, Field, FormModal, Input, PageHeader, PageSkeleton, StatusBadge } from "../../components/ui";
import { fmtDate, fmtDay, money } from "../../lib/format";
import { MealStats, MealSummaryTable } from "./Meals";

export default function MealPeriod() {
  const { pid } = useParams();
  const { homeId, can, isAdmin, currency, membershipId } = useHome();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["meals", homeId, "period", pid], queryFn: () => api.get(`/homes/${homeId}/meals/periods/${pid}`) });
  const inv = [["meals", homeId], ["finance"], ["dashboard", homeId]];
  const close = useAction(() => api.post(`/homes/${homeId}/meals/periods/${pid}/close`), { invalidate: inv, success: "Period closed — meal charges posted to every account", onSuccess: () => setModal(null) });
  const reopen = useAction(() => api.post(`/homes/${homeId}/meals/periods/${pid}/reopen`, { reason: form.reason }), { invalidate: inv, success: "Period reopened — charges reversed", onSuccess: () => setModal(null) });
  const edit = useAction(() => api.patch(`/homes/${homeId}/meals/periods/${pid}`, form), { invalidate: inv, success: "Period updated", onSuccess: () => setModal(null) });
  const del = useAction(() => api.del(`/homes/${homeId}/meals/periods/${pid}`), { invalidate: inv, success: "Period deleted", onSuccess: () => navigate(`/h/${homeId}/meals`) });

  if (isLoading) return <PageSkeleton />;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;
  const { period: p, summary: s } = data;
  const closed = p.status === "closed";
  const mine = s.members.find((m) => m.membership === membershipId);

  return (
    <div className="stack-lg">
      <PageHeader
        back={<Link to={`/h/${homeId}/meals`} className="row text-sm muted" style={{ gap: 4 }}><ArrowLeft size={14} /> Meals</Link>}
        title={<span className="row">{p.name} <StatusBadge status={p.status} /></span>}
        description={`${fmtDay(p.startDay, { month: "short", day: "numeric", year: "numeric" })} – ${fmtDay(p.endDay, { month: "short", day: "numeric", year: "numeric" })}${closed ? ` · closed ${fmtDate(p.closedAt)}${p.closedBy ? ` by ${p.closedBy.name || ""}` : ""}` : ""}`}
        actions={
          can("meals.configure") && (
            closed ? (
              isAdmin && <Button icon={LockOpen} onClick={() => { setForm({ reason: "" }); setModal("reopen"); }}>Reopen</Button>
            ) : (
              <>
                <Button variant="ghost" icon={Trash2} onClick={() => setModal("delete")} aria-label="Delete period" />
                <Button icon={Pencil} onClick={() => { setForm({ name: p.name, startDay: p.startDay, endDay: p.endDay }); setModal("edit"); }}>Edit</Button>
                <Button variant="primary" icon={Lock} onClick={() => setModal("close")}>Close period</Button>
              </>
            )
          )
        }
      />
      {!closed && <Alert tone="info">Live numbers — they change as meals and meal expenses are recorded. Closing freezes them and posts each member's meal cost to their account.</Alert>}
      {s.unallocated > 0 && <Alert tone="warning" icon={AlertTriangle}>{money(s.unallocated, currency)} of meal expenses can't be shared because no meals are recorded yet.</Alert>}
      <MealStats s={s} currency={currency} mine={mine} />
      <Card title="Per member">
        <MealSummaryTable summary={s} currency={currency} highlight={membershipId} />
        <div className="card-foot hint">
          Meal rate = {money(s.totalExpense - (s.guestRevenue || 0), currency)} ÷ {s.guestPricing === "fixed" ? s.memberMeals : s.chargeableMeals} meals = <b>{money(s.rate, currency)}</b> per meal.
          {" "}Weights: {s.mealTypes.map((t) => `${t.label} ${t.weight}`).join(", ")}. Costs are rounded so they add up exactly to the total.
        </div>
      </Card>

      <ConfirmDialog open={modal === "close"} onClose={() => setModal(null)} onConfirm={() => close.mutate()} loading={close.isPending} title={`Close ${p.name}?`} confirmLabel="Close & post charges"
        description={`Each member will be charged their meal cost at ${money(s.rate, currency)} per meal (total ${money(s.totalExpense, currency)}). Meals and meal expenses in this period are then locked.`} />
      <FormModal open={modal === "reopen"} onClose={() => setModal(null)} title="Reopen this period?" submitLabel="Reopen" loading={reopen.isPending} disabled={(form.reason || "").trim().length < 3} onSubmit={() => reopen.mutate()}>
        <Alert tone="warning">All meal charges from this period are reversed on members' ledgers (nothing is deleted). Close it again after making corrections.</Alert>
        <Field label="Reason"><Input value={form.reason || ""} maxLength={300} onChange={(e) => setForm({ reason: e.target.value })} placeholder="e.g. Missing bazar receipt" /></Field>
      </FormModal>
      <FormModal open={modal === "edit"} onClose={() => setModal(null)} title="Edit period" loading={edit.isPending} onSubmit={() => edit.mutate()}>
        <Field label="Name"><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Starts"><Input type="date" value={form.startDay || ""} onChange={(e) => setForm({ ...form, startDay: e.target.value })} /></Field>
          <Field label="Ends"><Input type="date" value={form.endDay || ""} onChange={(e) => setForm({ ...form, endDay: e.target.value })} /></Field>
        </div>
      </FormModal>
      <ConfirmDialog open={modal === "delete"} onClose={() => setModal(null)} onConfirm={() => del.mutate()} loading={del.isPending} danger title="Delete this period?" confirmLabel="Delete" description="Only the period is removed. Recorded meals and expenses stay as they are." />
    </div>
  );
}
