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
import { useT } from "../i18n/I18nProvider";
import { translate } from "../i18n";

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

const METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "card", "other"];
const INVALIDATE = (homeId) => [["finance"], ["expenses"], ["dashboard", homeId], ["members", homeId], ["meals", homeId]];

export function FileInput({ onChange, file, accept = "image/jpeg,image/png,image/webp,application/pdf" }) {
  return (
    <label className="btn btn-secondary" style={{ justifyContent: "flex-start", width: "100%", fontWeight: 500 }}>
      <Paperclip size={15} />
      <span className="truncate">{file ? file.name : translate("forms.attachReceipt")}</span>
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
  const t = useT();
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
    { invalidate: INVALIDATE(homeId), success: (r) => (r.entry.status === "pending" ? t("forms.payment.submitted") : t("forms.payment.recorded")), onSuccess: onClose }
  );
  const valid = /^\d+(\.\d{1,2})?$/.test(String(f.amount).trim()) && Number(f.amount) > 0;
  return (
    <FormModal open={open} onClose={onClose} title={recorder ? t("forms.payment.recordTitle") : t("forms.payment.submitTitle")} description={recorder ? t("forms.payment.recordDesc") : t("forms.payment.submitDesc")}
      submitLabel={recorder ? t("common.recordPayment") : t("forms.payment.submitForConfirm")} loading={submit.isPending} disabled={!valid} onSubmit={() => submit.mutate()}>
      {recorder && !fixedMember && (
        <Field label={t("common.member")}>
          <Select value={f.membershipId} onChange={(e) => setF({ ...f, membershipId: e.target.value })} options={members.map((m) => ({ value: m._id, label: m.user.name }))} />
        </Field>
      )}
      <div className="form-grid">
        <Field label={t("forms.amountIn", { currency })}><Input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus /></Field>
        <Field label={t("forms.method")}><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={METHODS.map((value) => ({ value, label: t(`tx.method.${value}`) }))} /></Field>
        <Field label={t("common.date")}><Input type="date" value={f.day} max={localDay()} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
        <Field label={t("forms.reference")} optional><Input value={f.description} maxLength={300} placeholder={t("forms.referencePlaceholder")} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
      <FileInput file={f.file} onChange={(file) => setF({ ...f, file })} />
    </FormModal>
  );
}

function AdjustmentForm({ open, onClose, membershipId: fixedMember }) {
  const { homeId, currency } = useHome();
  const t = useT();
  const members = useActiveMembers();
  const [f, setF] = useState(() => ({ membershipId: fixedMember || "", direction: "credit", type: "adjustment", amount: "", description: "", day: localDay() }));
  const submit = useAction(() => api.post(`/homes/${homeId}/finance/adjustments`, f), { invalidate: INVALIDATE(homeId), success: t("forms.adjust.added"), onSuccess: onClose });
  return (
    <FormModal open={open} onClose={onClose} title={t("forms.adjust.title")} description={t("forms.adjust.desc")} submitLabel={t("forms.adjust.submit")} loading={submit.isPending}
      disabled={!f.membershipId || !Number(f.amount) || (f.description || "").trim().length < 3} onSubmit={() => submit.mutate()}>
      {!fixedMember && (
        <Field label={t("common.member")}>
          <Select value={f.membershipId} onChange={(e) => setF({ ...f, membershipId: e.target.value })}>
            <option value="">{t("forms.chooseMember")}</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        </Field>
      )}
      <Segmented label={t("forms.adjust.direction")} value={f.direction} onChange={(d) => setF({ ...f, direction: d })} items={[{ value: "credit", label: t("forms.adjust.credit") }, { value: "debit", label: t("forms.adjust.debit") }]} />
      <div className="form-grid">
        <Field label={t("forms.amountIn", { currency })}><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label={t("forms.adjust.kind")}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: "adjustment", label: t("entries.adjustment") }, { value: "opening_balance", label: t("entries.opening_balance") }]} /></Field>
        <Field label={t("forms.description")} className="full"><Input value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </FormModal>
  );
}

function ExpenseForm({ open, onClose, expense }) {
  const { homeId, can, currency } = useHome();
  const t = useT();
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
    { invalidate: INVALIDATE(homeId), success: expense ? t("forms.expense.updated") : t("forms.expense.added"), onSuccess: onClose }
  );
  const total = parseMinor(f.amount);
  const valid = f.title?.trim() && total > 0 && (isMeal || !splitError(f.split, members, total));

  return (
    <FormModal open={open} onClose={onClose} title={expense ? t("forms.expense.editTitle") : t("common.addExpense")} size="lg" submitLabel={expense ? t("common.saveChanges") : t("common.addExpense")} loading={submit.isPending} disabled={!valid} onSubmit={() => submit.mutate()}>
      {expense && <Alert tone="neutral">{t("forms.expense.editNote")}</Alert>}
      <div className="form-grid">
        <Field label={t("forms.title")} className="full"><Input value={f.title || ""} maxLength={120} placeholder={t("forms.expense.titlePlaceholder")} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t("expenses.category")}><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} /></Field>
        <Field label={t("forms.amountIn", { currency })}><Input inputMode="decimal" placeholder="0.00" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label={t("common.date")}><Input type="date" value={f.day || ""} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
        <Field label={t("expenses.paidBy")} hint={f.paidBy ? t("forms.expense.paidByHint") : t("forms.expense.fundHint")}>
          <Select value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })}>
            <option value="">{t("finance.homeFund")}</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        </Field>
      </div>
      {isMeal ? (
        <Alert tone="info">{t("forms.expense.mealNote")}</Alert>
      ) : (
        <Field label={t("recurring.whoPaysWhat")}>
          <SplitEditor value={f.split} onChange={(split) => setF({ ...f, split })} members={members} totalMinor={total} currency={currency} />
        </Field>
      )}
      <Field label={t("common.notes")} optional><Textarea value={f.notes || ""} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <FileInput file={f.file} onChange={(file) => setF({ ...f, file })} />
    </FormModal>
  );
}
