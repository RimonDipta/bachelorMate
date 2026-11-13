import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Receipt, Paperclip, MoreHorizontal, Pencil, Ban, History, Search, Download } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { useAction, useDebounced } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, Modal, Money, PageHeader, Select, Segmented } from "../../components/ui";
import { CATEGORY_LABEL, MEAL_CATEGORIES, fmtDate, fmtDay, money, monthKey, monthLabel, shiftMonth } from "../../lib/format";
import { ExpenseModal } from "../../components/FinanceForms";

const SPLIT = { meal_pool: "Meal pool", equal: "Split equally", selected: "Selected members", custom: "Custom amounts", none: "Home fund" };

export default function Expenses() {
  const { homeId, can, currency } = useHome();
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
  const voidExp = useAction(() => api.post(`/homes/${homeId}/expenses/${voiding._id}/void`, { reason }), { invalidate: [["expenses"], ["finance"], ["dashboard", homeId], ["meals", homeId]], success: "Expense voided", onSuccess: () => setVoiding(null) });
  const canEdit = (e) => can("expenses.manage") || (can("expenses.meal") && MEAL_CATEGORIES.includes(e.category));
  const addOpen = params.get("new") === "1";
  const closeAdd = () => setParams({});

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Bazar, bills and everything the home pays for."
        actions={
          <>
            <Button icon={Download} onClick={() => api.download(`/homes/${homeId}/reports/monthly-financial`, { month, format: "csv" }, `expenses-${month}.csv`).catch((e) => toast.error(e))} disabled={!can("reports.view")} title={can("reports.view") ? "" : "Requires report access"}>Export</Button>
            {can("expenses.manage", "expenses.meal") && <Button variant="primary" icon={Plus} onClick={() => setParams({ new: "1" })}>Add expense</Button>}
          </>
        }
      />
      <div className="row wrap between" style={{ marginBottom: 12 }}>
        <div className="row">
          <Button icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="strong" style={{ minWidth: 140, textAlign: "center" }}>{monthLabel(month)}</span>
          <Button icon={ChevronRight} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
        <div className="row wrap">
          <div className="input-group" style={{ width: 200 }}><Search /><Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 170 }} aria-label="Category">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Segmented label="Status" value={status} onChange={setStatus} items={[{ value: "active", label: "Active" }, { value: "void", label: "Void" }, { value: "all", label: "All" }]} />
        </div>
      </div>
      <Card title={data ? <h2>Total <span className="num">{money(data.total, currency)}</span></h2> : "Expenses"}>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.expenses.length ? (
          <EmptyState icon={Receipt} title="No expenses" description={`Nothing recorded for ${monthLabel(month)}.`} action={can("expenses.manage", "expenses.meal") && <Button variant="primary" icon={Plus} onClick={() => setParams({ new: "1" })}>Add expense</Button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Expense</th><th className="hide-sm">Paid by</th><th className="hide-sm">Split</th><th className="r">Amount</th><th /></tr></thead>
              <tbody>
                {data.expenses.map((e) => (
                  <tr key={e._id} style={e.status === "void" ? { opacity: 0.55 } : undefined}>
                    <td className="text-sm" style={{ whiteSpace: "nowrap" }}>{fmtDay(e.day)}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="text-sm strong truncate" style={e.status === "void" ? { textDecoration: "line-through" } : undefined}>{e.title}</span>
                        {e.receipt && <button className="btn btn-ghost btn-sm" style={{ height: 22, padding: "0 4px" }} aria-label="View receipt" onClick={() => api.open(`/homes/${homeId}/files/${e.receipt}`).catch((err) => toast.error(err))}><Paperclip size={13} /></button>}
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <Badge tone={MEAL_CATEGORIES.includes(e.category) ? "accent" : undefined}>{CATEGORY_LABEL[e.category]}</Badge>
                        {e.status === "void" && <Badge tone="danger">Void</Badge>}
                        {e.history?.length > 1 && <Badge>Edited</Badge>}
                        {e.recurring?.template && <Badge tone="info">Recurring</Badge>}
                      </div>
                    </td>
                    <td className="hide-sm">{e.paidBy ? <div className="row"><Avatar user={e.paidBy.user} size={22} /><span className="text-sm">{e.paidBy.user?.name}</span></div> : <span className="text-sm muted">Home fund</span>}</td>
                    <td className="hide-sm text-sm muted">{SPLIT[e.allocation.mode]}{e.allocation.mode === "selected" ? ` (${e.allocation.memberships.length})` : ""}</td>
                    <td className="r strong"><Money value={e.amount} currency={currency} /></td>
                    <td>
                      <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label="Expense actions" />}>
                        <MenuItem icon={History} onClick={() => setHistory(e)}>View history</MenuItem>
                        {canEdit(e) && e.status === "active" && <MenuItem icon={Pencil} onClick={() => setEditing(e)}>Edit</MenuItem>}
                        {canEdit(e) && e.status === "active" && <MenuItem icon={Ban} danger onClick={() => { setReason(""); setVoiding(e); }}>Void</MenuItem>}
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
      <FormModal open={Boolean(voiding)} onClose={() => setVoiding(null)} danger title={`Void “${voiding?.title}”?`} submitLabel="Void expense" loading={voidExp.isPending} disabled={reason.trim().length < 3} onSubmit={() => voidExp.mutate()}>
        <p className="text-sm muted">Its ledger entries are reversed. The expense stays visible as void for the record.</p>
        <Field label="Reason"><Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
      </FormModal>
      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title="Expense history" description={history?.title}>
        <div className="timeline">
          {history?.history?.map((h, i) => (
            <div key={i} className="timeline-item" style={{ padding: "8px 0" }}>
              <div className="timeline-dot"><History /></div>
              <div className="grow">
                <div className="text-sm"><b>{h.by?.name || "Someone"}</b> {h.action} this expense</div>
                {h.changes && Object.entries(h.changes).map(([k, v]) => (
                  <div key={k} className="text-xs muted">
                    {k}: {k === "amount" ? `${money(v.from, currency)} → ${money(v.to, currency)}` : v && typeof v === "object" && "to" in v ? `${String(v.from ?? "—")} → ${String(v.to ?? "—")}` : String(v)}
                  </div>
                ))}
                <div className="text-xs subtle">{fmtDate(h.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          {history?.notes && <p className="text-sm muted" style={{ marginTop: 8 }}>Notes: {history.notes}</p>}
        </div>
      </Modal>
    </>
  );
}
