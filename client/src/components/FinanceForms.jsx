/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { api } from "../lib/api";
import { useHome } from "../context/HomeContext";
import { useAction } from "../lib/hooks";
import { Alert, Field, FormModal, Input, Select, Textarea, Segmented } from "./ui";
import { CATEGORY_LABEL, MEAL_CATEGORIES, localDay } from "../lib/format";
import { parseMinor, minorToInput } from "../lib/money";
import SplitEditor, { emptySplit, splitError, splitToAllocation } from "./SplitEditor";

/** Saved expense allocation → split editor state. */
function expenseToSplit(a) {
  if (a.mode === "custom") return { ...emptySplit(), mode: "custom", shares: Object.fromEntries((a.shares || []).map((s) => [String(s.membership), minorToInput(s.amount)])) };
  if (a.mode === "selected") return { ...emptySplit(), allMembers: false, memberships: (a.memberships || []).map(String) };
  if (a.mode === "none") return { ...emptySplit(), mode: "none" };
  return emptySplit();
}

export function useActiveMembers() {
  const { homeId } = useHome();
  const { data } = useQuery({ queryKey: ["members", homeId, "active"], queryFn: () => api.get(`/homes/${homeId}/members`, { status: "active" }) });
  return data?.members || [];
}

const METHODS = [["cash", "Cash"], ["bkash", "bKash"], ["nagad", "Nagad"], ["rocket", "Rocket"], ["bank", "Bank transfer"], ["card", "Card"], ["other", "Other"]];
const INVALIDATE = (homeId) => [["finance"], ["expenses"], ["dashboard", homeId], ["members", homeId], ["meals", homeId]];

export function FileInput({ onChange, file, accept = "image/jpeg,image/png,image/webp,application/pdf" }) {
  return (
    <label className="btn btn-secondary" style={{ justifyContent: "flex-start", width: "100%", fontWeight: 500 }}>
      <Paperclip size={15} />
      <span className="truncate">{file ? file.name : "Attach receipt (JPG, PNG, WEBP or PDF, max 5 MB)"}</span>
      <input type="file" accept={accept} hidden onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </label>
  );
}

// Forms mount fresh each time their modal opens, so state starts clean.
export const PaymentModal = (props) => (props.open ? <PaymentForm {...props} /> : null);
export const AdjustmentModal = (props) => (props.open ? <AdjustmentForm {...props} /> : null);
export const ExpenseModal = (props) => (props.open ? <ExpenseForm {...props} /> : null);

function PaymentForm({ open, onClose, membershipId: fixedMember }) {
  const { homeId, can, membershipId, currency } = useHome();
  const recorder = can("finance.record");
  const members = useActiveMembers();
  const [f, setF] = useState(() => ({ membershipId: fixedMember || membershipId, amount: "", method: "cash", day: localDay(), description: "", file: null }));
  const submit = useAction(
    () => {
      const fd = new FormData();
      fd.append("membershipId", f.membershipId);
      fd.append("amount", f.amount);
      fd.append("method", f.method);
      fd.append("day", f.day);
      if (f.description) fd.append("description", f.description);
      if (f.file) fd.append("attachment", f.file);
      return api.post(`/homes/${homeId}/finance/payments`, fd);
    },
    { invalidate: INVALIDATE(homeId), success: (r) => (r.entry.status === "pending" ? "Payment submitted — waiting for confirmation" : "Payment recorded"), onSuccess: onClose }
  );
  const valid = /^\d+(\.\d{1,2})?$/.test(String(f.amount).trim()) && Number(f.amount) > 0;
  return (
    <FormModal open={open} onClose={onClose} title={recorder ? "Record a payment" : "Submit a payment"} description={recorder ? "Money a member paid into the home fund." : "Tell the manager you've paid. It counts once they confirm it."}
      submitLabel={recorder ? "Record payment" : "Submit for confirmation"} loading={submit.isPending} disabled={!valid} onSubmit={() => submit.mutate()}>
      {recorder && !fixedMember && (
        <Field label="Member">
          <Select value={f.membershipId} onChange={(e) => setF({ ...f, membershipId: e.target.value })} options={members.map((m) => ({ value: m._id, label: m.user.name }))} />
        </Field>
      )}
      <div className="form-grid">
        <Field label={`Amount (${currency})`}><Input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={METHODS.map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Date"><Input type="date" value={f.day} max={localDay()} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
        <Field label="Reference" optional><Input value={f.description} maxLength={300} placeholder="e.g. TrxID or note" onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <FileInput file={f.file} onChange={(file) => setF({ ...f, file })} />
    </FormModal>
  );
}

function AdjustmentForm({ open, onClose, membershipId: fixedMember }) {
  const { homeId, currency } = useHome();
  const members = useActiveMembers();
  const [f, setF] = useState(() => ({ membershipId: fixedMember || "", direction: "credit", type: "adjustment", amount: "", description: "", day: localDay() }));
  const submit = useAction(() => api.post(`/homes/${homeId}/finance/adjustments`, f), { invalidate: INVALIDATE(homeId), success: "Adjustment added", onSuccess: onClose });
  return (
    <FormModal open={open} onClose={onClose} title="Add an adjustment" description="For corrections, opening balances or one-off charges. Every adjustment is logged." submitLabel="Add adjustment" loading={submit.isPending}
      disabled={!f.membershipId || !Number(f.amount) || (f.description || "").trim().length < 3} onSubmit={() => submit.mutate()}>
      {!fixedMember && (
        <Field label="Member">
          <Select value={f.membershipId} onChange={(e) => setF({ ...f, membershipId: e.target.value })}>
            <option value="">Choose a member</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        </Field>
      )}
      <Segmented label="Direction" value={f.direction} onChange={(d) => setF({ ...f, direction: d })} items={[{ value: "credit", label: "Credit (reduces dues)" }, { value: "debit", label: "Charge (adds dues)" }]} />
      <div className="form-grid">
        <Field label={`Amount (${currency})`}><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Kind"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: "adjustment", label: "Adjustment" }, { value: "opening_balance", label: "Opening balance" }]} /></Field>
        <Field label="Description" className="full"><Input value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </FormModal>
  );
}

function ExpenseForm({ open, onClose, expense }) {
  const { homeId, can, currency } = useHome();
  const members = useActiveMembers();
  const canAll = can("expenses.manage");
  const categories = Object.keys(CATEGORY_LABEL).filter((c) => canAll || MEAL_CATEGORIES.includes(c));
  const [f, setF] = useState(() =>
    expense
      ? ({ title: expense.title, category: expense.category, amount: (expense.amount / 100).toFixed(2), day: expense.day, paidBy: expense.paidBy?._id || "", split: expenseToSplit(expense.allocation), notes: expense.notes || "", file: null })
      : { title: "", category: categories[0], amount: "", day: localDay(), paidBy: "", split: emptySplit(), notes: "", file: null }
  );
  const isMeal = MEAL_CATEGORIES.includes(f.category);
  const submit = useAction(
    () => {
      const fd = new FormData();
      ["title", "category", "amount", "day", "notes"].forEach((k) => f[k] !== undefined && fd.append(k, f[k]));
      fd.append("paidBy", f.paidBy || "");
      const s = f.split;
      const mode = isMeal ? "meal_pool" : s.mode === "none" ? "none" : s.mode === "custom" ? "custom" : s.allMembers ? "equal" : "selected";
      fd.append("allocationMode", mode);
      fd.append("memberships", JSON.stringify(mode === "selected" ? s.memberships : []));
      if (mode === "custom") fd.append("shares", JSON.stringify(splitToAllocation(s, members).shares));
      if (f.file) fd.append("receipt", f.file);
      return expense ? api.patch(`/homes/${homeId}/expenses/${expense._id}`, fd) : api.post(`/homes/${homeId}/expenses`, fd);
    },
    { invalidate: INVALIDATE(homeId), success: expense ? "Expense updated" : "Expense added", onSuccess: onClose }
  );
  const total = parseMinor(f.amount);
  const valid = f.title?.trim() && total > 0 && (isMeal || !splitError(f.split, members, total));

  return (
    <FormModal open={open} onClose={onClose} title={expense ? "Edit expense" : "Add expense"} size="lg" submitLabel={expense ? "Save changes" : "Add expense"} loading={submit.isPending} disabled={!valid} onSubmit={() => submit.mutate()}>
      {expense && <Alert tone="neutral">Changing the amount, date, payer or split reverses the old ledger entries and posts new ones. The edit is recorded in the expense history.</Alert>}
      <div className="form-grid">
        <Field label="Title" className="full"><Input value={f.title || ""} maxLength={120} placeholder="e.g. Weekly bazar" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} /></Field>
        <Field label={`Amount (${currency})`}><Input inputMode="decimal" placeholder="0.00" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Date"><Input type="date" value={f.day || ""} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
        <Field label="Paid by" hint={f.paidBy ? "They'll be credited the full amount." : "Taken from money members already paid in."}>
          <Select value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })}>
            <option value="">Home fund</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        </Field>
      </div>
      {isMeal ? (
        <Alert tone="info">Meal expenses go into the meal pool. They're shared by meals eaten when the meal period is closed.</Alert>
      ) : (
        <Field label="Who pays what">
          <SplitEditor value={f.split} onChange={(split) => setF({ ...f, split })} members={members} totalMinor={total} currency={currency} />
        </Field>
      )}
      <Field label="Notes" optional><Textarea value={f.notes || ""} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <FileInput file={f.file} onChange={(file) => setF({ ...f, file })} />
    </FormModal>
  );
}
