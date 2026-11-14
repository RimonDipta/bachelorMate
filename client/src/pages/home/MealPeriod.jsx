import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, LockOpen, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Button, Card, ConfirmDialog, ErrorState, Field, FormModal, Input, PageHeader, PageSkeleton, StatusBadge } from "../../components/ui";
import { fmtDate, fmtDay, mealTypeLabel, money, num, periodName } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";
import { MealStats, MealSummaryTable } from "./Meals";

export default function MealPeriod() {
  const { pid } = useParams();
  const { homeId, can, isAdmin, currency, membershipId } = useHome();
  const navigate = useNavigate();
  const t = useT();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["meals", homeId, "period", pid], queryFn: () => api.get(`/homes/${homeId}/meals/periods/${pid}`) });
  const inv = [["meals", homeId], ["finance"], ["dashboard", homeId]];
  const close = useAction(() => api.post(`/homes/${homeId}/meals/periods/${pid}/close`), { invalidate: inv, success: t("period.closedToast"), onSuccess: () => setModal(null) });
  const reopen = useAction(() => api.post(`/homes/${homeId}/meals/periods/${pid}/reopen`, { reason: form.reason }), { invalidate: inv, success: t("period.reopenedToast"), onSuccess: () => setModal(null) });
  const edit = useAction(() => api.patch(`/homes/${homeId}/meals/periods/${pid}`, form), { invalidate: inv, success: t("period.updated"), onSuccess: () => setModal(null) });
  const del = useAction(() => api.del(`/homes/${homeId}/meals/periods/${pid}`), { invalidate: inv, success: t("period.deleted"), onSuccess: () => navigate(`/h/${homeId}/meals`) });

  if (isLoading) return <PageSkeleton />;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;
  const { period: p, summary: s } = data;
  const closed = p.status === "closed";
  const mine = s.members.find((m) => m.membership === membershipId);

  return (
    <div className="stack-lg">
      <PageHeader
        back={<Link to={`/h/${homeId}/meals`} className="row text-sm muted" style={{ gap: 4 }}><ArrowLeft size={14} /> {t("nav.meals")}</Link>}
        title={<span className="row">{periodName(p.name)} <StatusBadge status={p.status} /></span>}
        description={`${fmtDay(p.startDay, { month: "short", day: "numeric", year: "numeric" })} – ${fmtDay(p.endDay, { month: "short", day: "numeric", year: "numeric" })}${closed ? ` · ${t("period.closedOn", { day: fmtDate(p.closedAt) })}${p.closedBy ? ` ${t("period.by", { name: p.closedBy.name || "" })}` : ""}` : ""}`}
        actions={
          can("meals.configure") && (
            closed ? (
              isAdmin && <Button icon={LockOpen} onClick={() => { setForm({ reason: "" }); setModal("reopen"); }}>{t("period.reopen")}</Button>
            ) : (
              <>
                <Button variant="ghost" icon={Trash2} onClick={() => setModal("delete")} aria-label={t("period.deleteLabel")} />
                <Button icon={Pencil} onClick={() => { setForm({ name: p.name, startDay: p.startDay, endDay: p.endDay }); setModal("edit"); }}>{t("common.edit")}</Button>
                <Button variant="primary" icon={Lock} onClick={() => setModal("close")}>{t("period.close")}</Button>
              </>
            )
          )
        }
      />
      {!closed && <Alert tone="info">{t("period.liveNote")}</Alert>}
      {s.unallocated > 0 && <Alert tone="warning" icon={AlertTriangle}>{t("period.unallocated", { amount: money(s.unallocated, currency) })}</Alert>}
      <MealStats s={s} currency={currency} mine={mine} />
      <Card title={t("period.perMember")}>
        <MealSummaryTable summary={s} currency={currency} highlight={membershipId} />
        <div className="card-foot hint">
          {t("period.formulaBefore", { expense: money(s.totalExpense - (s.guestRevenue || 0), currency), meals: s.guestPricing === "fixed" ? s.memberMeals : s.chargeableMeals })}<b>{money(s.rate, currency)}</b>{t("period.formulaAfter")}
          {" "}{t("period.weights", { list: s.mealTypes.map((mt) => `${mealTypeLabel(mt)} ${num(mt.weight)}`).join(", ") })}
        </div>
      </Card>

      <ConfirmDialog open={modal === "close"} onClose={() => setModal(null)} onConfirm={() => close.mutate()} loading={close.isPending} title={t("period.closeTitle", { name: periodName(p.name) })} confirmLabel={t("period.closeSubmit")}
        description={t("period.closeDesc", { rate: money(s.rate, currency), total: money(s.totalExpense, currency) })} />
      <FormModal open={modal === "reopen"} onClose={() => setModal(null)} title={t("period.reopenTitle")} submitLabel={t("period.reopen")} loading={reopen.isPending} disabled={(form.reason || "").trim().length < 3} onSubmit={() => reopen.mutate()}>
        <Alert tone="warning">{t("period.reopenWarning")}</Alert>
        <Field label={t("common.reason")}><Input value={form.reason || ""} maxLength={300} onChange={(e) => setForm({ reason: e.target.value })} placeholder={t("period.reasonPlaceholder")} /></Field>
      </FormModal>
      <FormModal open={modal === "edit"} onClose={() => setModal(null)} title={t("period.editTitle")} loading={edit.isPending} onSubmit={() => edit.mutate()}>
        <Field label={t("common.name")}><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label={t("common.starts")}><Input type="date" value={form.startDay || ""} onChange={(e) => setForm({ ...form, startDay: e.target.value })} /></Field>
          <Field label={t("common.ends")}><Input type="date" value={form.endDay || ""} onChange={(e) => setForm({ ...form, endDay: e.target.value })} /></Field>
        </div>
      </FormModal>
      <ConfirmDialog open={modal === "delete"} onClose={() => setModal(null)} onConfirm={() => del.mutate()} loading={del.isPending} danger title={t("period.deleteTitle")} confirmLabel={t("common.delete")} description={t("period.deleteHint")} />
    </div>
  );
}
