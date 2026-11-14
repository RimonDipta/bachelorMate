import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Receipt, Paperclip, MoreHorizontal, Pencil, Ban, History, Search, Download } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { useAction, useDebounced } from "../../lib/hooks";
import { useT } from "../../i18n/I18nProvider";
import { translateOr } from "../../i18n";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, Modal, Money, PageHeader, Select, Segmented } from "../../components/ui";
import { CATEGORY_LABEL, MEAL_CATEGORIES, fmtDate, fmtDay, money, monthKey, monthLabel, num, shiftMonth } from "../../lib/format";
import { ExpenseModal } from "../../components/FinanceForms";

export default function Expenses() {
  const { homeId, can, currency } = useHome();
  const t = useT();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(monthKey());
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [editing, setEditing] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [history, setHistory] = useState(null);
  const [reason, setReason] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["expenses", homeId, month, category, status, dq], queryFn: () => api.get(`/homes/${homeId}/expenses`, { month, category, status, q: dq }) });
  const voidExp = useAction(() => api.post(`/homes/${homeId}/expenses/${voiding._id}/void`, { reason }), { invalidate: [["expenses"], ["finance"], ["dashboard", homeId], ["meals", homeId]], success: t("expenses.voided"), onSuccess: () => setVoiding(null) });
  const canEdit = (e) => can("expenses.manage") || (can("expenses.meal") && MEAL_CATEGORIES.includes(e.category));
  const addOpen = params.get("new") === "1";
  const closeAdd = () => setParams({});

  return (
    <>
      <PageHeader
        title={t("nav.expenses")}
        description={t("expenses.desc")}
        actions={
          <>
            <Button icon={Download} onClick={() => api.download(`/homes/${homeId}/reports/monthly-financial`, { month, format: "csv" }, `expenses-${month}.csv`).catch((e) => toast.error(e))} disabled={!can("reports.view")} title={can("reports.view") ? "" : t("expenses.needsReports")}>{t("common.export")}</Button>
            {can("expenses.manage", "expenses.meal") && <Button variant="primary" icon={Plus} onClick={() => setParams({ new: "1" })}>{t("common.addExpense")}</Button>}
          </>
        }
      />
      <div className="row wrap between" style={{ marginBottom: 12 }}>
        <div className="row">
          <Button icon={ChevronLeft} aria-label={t("common.prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="strong" style={{ minWidth: 140, textAlign: "center" }}>{monthLabel(month)}</span>
          <Button icon={ChevronRight} aria-label={t("common.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
        <div className="row wrap">
          <div className="input-group" style={{ width: 200 }}><Search /><Input placeholder={t("common.search")} aria-label={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 170 }} aria-label={t("expenses.category")}>
            <option value="">{t("expenses.allCategories")}</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Segmented label={t("common.status")} value={status} onChange={setStatus} items={[{ value: "active", label: t("expenses.active") }, { value: "void", label: t("expenses.void") }, { value: "all", label: t("common.all") }]} />
        </div>
      </div>
      <Card title={data ? <h2>{t("common.total")} <span className="num">{money(data.total, currency)}</span></h2> : t("nav.expenses")}>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.expenses.length ? (
          <EmptyState icon={Receipt} title={t("expenses.none")} description={t("expenses.noneFor", { month: monthLabel(month) })} action={can("expenses.manage", "expenses.meal") && <Button variant="primary" icon={Plus} onClick={() => setParams({ new: "1" })}>{t("common.addExpense")}</Button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("common.date")}</th><th>{t("expenses.expense")}</th><th className="hide-sm">{t("expenses.paidBy")}</th><th className="hide-sm">{t("expenses.split")}</th><th className="r">{t("common.amount")}</th><th /></tr></thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e._id} style={e.status === "void" ? { opacity: 0.55 } : undefined}>
                    <td className="text-sm" style={{ whiteSpace: "nowrap" }}>{fmtDay(e.day)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="text-sm strong truncate" style={e.status === "void" ? { textDecoration: "line-through" } : undefined}>{e.title}</span>
                        {e.receipt && <button className="btn btn-ghost btn-sm" style={{ height: 22, padding: "0 4px" }} aria-label={t("expenses.viewReceipt")} onClick={() => api.openFile(e.receipt, homeId).catch((err) => toast.error(err))}><Paperclip size={13} /></button>}
                      </div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <Badge tone={MEAL_CATEGORIES.includes(e.category) ? "accent" : undefined}>{CATEGORY_LABEL[e.category]}</Badge>
                        {e.status === "void" && <Badge tone="danger">{t("expenses.void")}</Badge>}
                        {e.history?.length > 1 && <Badge>{t("expenses.edited")}</Badge>}
                        {e.recurring?.template && <Badge tone="info">{t("expenses.recurring")}</Badge>}
                      </div>
                    </td>
                    <td className="hide-sm">{e.paidBy ? <div className="row"><Avatar user={e.paidBy.user} size={22} /><span className="text-sm">{e.paidBy.user?.name}</span></div> : <span className="text-sm muted">{t("finance.homeFund")}</span>}</td>
                    <td className="hide-sm text-sm muted">{t(`expenses.splitMode.${e.allocation.mode}`)}{e.allocation.mode === "selected" ? ` (${num(e.allocation.memberships.length)})` : ""}</td>
                    <td className="r strong"><Money value={e.amount} currency={currency} /></td>
                    <td>
                      <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={t("expenses.actions")} />}>
                        <MenuItem icon={History} onClick={() => setHistory(e)}>{t("expenses.viewHistory")}</MenuItem>
                        {canEdit(e) && e.status === "active" && <MenuItem icon={Pencil} onClick={() => setEditing(e)}>{t("common.edit")}</MenuItem>}
                        {canEdit(e) && e.status === "active" && <MenuItem icon={Ban} danger onClick={() => { setReason(""); setVoiding(e); }}>{t("expenses.voidAction")}</MenuItem>}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ExpenseModal open={addOpen || Boolean(editing)} expense={editing} onClose={() => { setEditing(null); closeAdd(); }} />
      <FormModal open={Boolean(voiding)} onClose={() => setVoiding(null)} danger title={t("expenses.voidTitle", { title: voiding?.title })} submitLabel={t("expenses.voidSubmit")} loading={voidExp.isPending} disabled={reason.trim().length < 3} onSubmit={() => voidExp.mutate()}>
        <p className="text-sm muted">{t("expenses.voidHint")}</p>
        <Field label={t("common.reason")}><Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
      </FormModal>
      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={t("expenses.historyTitle")} description={history?.title}>
        <div className="timeline">
          {history?.history?.map((h, i) => (
            <div key={i} className="timeline-item" style={{ padding: "8px 0" }}>
              <div className="timeline-dot"><History /></div>
              <div className="grow">
                <div className="text-sm"><b>{h.by?.name || t("expenses.someone")}</b> {translateOr(`expenses.historyAction.${h.action}`, `${h.action} this expense`)}</div>
                {h.changes && Object.entries(h.changes).map(([k, v]) => (
                  <div key={k} className="text-xs muted">
                    {translateOr(`expenses.field.${k}`, k)}: {k === "amount" ? `${money(v.from, currency)} → ${money(v.to, currency)}` : v && typeof v === "object" && "to" in v ? `${String(v.from ?? "—")} → ${String(v.to ?? "—")}` : String(v)}
                  </div>
                ))}
                <div className="text-xs subtle">{fmtDate(h.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          {history?.notes && <p className="text-sm muted" style={{ marginTop: 8 }}>{t("expenses.notes", { notes: history.notes })}</p>}
        </div>
      </Modal>
    </>
  );
}
