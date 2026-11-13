/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Check, X, Undo2, Search, ArrowLeftRight, Paperclip, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { useAction, useDebounced } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Money, PageHeader, Select, StatusBadge } from "../../components/ui";
import { ENTRY_LABEL, fmtDay } from "../../lib/format";
import { useActiveMembers } from "../../components/FinanceForms";

export function EntryRow({ e, currency, showMember, onApprove, onReject, onReverse, onAttachment }) {
  const signed = e.direction === "credit" ? e.amount : -e.amount;
  const reversible = onReverse && e.status === "posted" && !e.reversedBy && e.type !== "reversal" && !e.refKind;
  return (
    <tr style={e.reversedBy || e.status === "rejected" ? { opacity: 0.6 } : undefined}>
      <td className="text-sm" style={{ whiteSpace: "nowrap" }}>{fmtDay(e.day)}</td>
      {showMember && <td><div className="row"><Avatar user={e.membership?.user} size={22} /><span className="text-sm truncate">{e.membership?.user?.name}</span></div></td>}
      <td>
        <div className="text-sm">{e.description || ENTRY_LABEL[e.type]}</div>
        <div className="row text-xs muted" style={{ gap: 6 }}>
          <span>{ENTRY_LABEL[e.type]}</span>
          {e.method && <span>· {e.method}</span>}
          {e.recordedBy?.name && <span className="hide-sm">· by {e.recordedBy.name}</span>}
          {e.reversedBy && <Badge>Reversed</Badge>}
          {e.attachment && <button className="btn btn-ghost btn-sm" style={{ height: 20, padding: "0 4px" }} onClick={() => onAttachment(e.attachment)} aria-label="View attachment"><Paperclip size={12} /></button>}
        </div>
      </td>
      <td className="r strong" style={{ whiteSpace: "nowrap" }}><Money value={signed} currency={currency} sign colored /></td>
      {e.runningBalance !== undefined && <td className="r num muted hide-sm"><Money value={e.runningBalance} currency={currency} /></td>}
      <td>{e.status !== "posted" && <StatusBadge status={e.status} />}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        {e.status === "pending" && onApprove && (
          <div className="row">
            <Button size="sm" variant="ghost" icon={X} aria-label="Reject" onClick={() => onReject(e)} />
            <Button size="sm" variant="primary" icon={Check} onClick={() => onApprove(e)}>Confirm</Button>
          </div>
        )}
        {reversible && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onReverse(e)}>Reverse</Button>}
      </td>
    </tr>
  );
}

export function useEntryActions(homeId) {
  const toast = useToast();
  const [reversing, setReversing] = useState(null);
  const [reason, setReason] = useState("");
  const inv = [["finance"], ["dashboard", homeId], ["members", homeId]];
  const approve = useAction((e) => api.post(`/homes/${homeId}/finance/entries/${e._id}/approve`), { invalidate: inv, success: "Payment confirmed" });
  const reject = useAction((e) => api.post(`/homes/${homeId}/finance/entries/${e._id}/reject`, {}), { invalidate: inv, success: "Payment rejected" });
  const reverse = useAction(() => api.post(`/homes/${homeId}/finance/entries/${reversing._id}/reverse`, { reason }), { invalidate: inv, success: "Entry reversed", onSuccess: () => setReversing(null) });
  const openAttachment = (path) => api.openFile(path, homeId).catch((e) => toast.error(e));
  const modal = (
    <FormModal open={Boolean(reversing)} onClose={() => setReversing(null)} title="Reverse this entry?" submitLabel="Reverse" danger loading={reverse.isPending} disabled={reason.trim().length < 3} onSubmit={() => reverse.mutate()}>
      <p className="text-sm muted">A matching opposite entry is added; the original stays visible in the history.</p>
      <Field label="Reason"><Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Recorded for the wrong member" /></Field>
    </FormModal>
  );
  return {
    onApprove: (e) => approve.mutate(e),
    onReject: (e) => reject.mutate(e),
    onReverse: (e) => { setReason(""); setReversing(e); },
    onAttachment: openAttachment,
    modal,
  };
}

export default function Transactions() {
  const { homeId, can, currency } = useHome();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const full = can("finance.view_all");
  const members = useActiveMembers();
  const filters = { type: params.get("type") || "", status: params.get("status") || "", membershipId: params.get("member") || "", from: params.get("from") || "", to: params.get("to") || "", q: dq, page: params.get("page") || 1 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["finance", homeId, "tx", filters], queryFn: () => api.get(`/homes/${homeId}/finance/transactions`, filters), placeholderData: (prev) => prev });
  const actions = useEntryActions(homeId);
  const setFilter = (k, v) => {
    const next = Object.fromEntries(params);
    if (v) next[k] = v;
    else delete next[k];
    if (k !== "page") delete next.page;
    setParams(next);
  };
  const exportCsv = () => api.download(`/homes/${homeId}/finance/transactions.csv`, { ...filters, page: undefined }, "transactions.csv").catch((e) => toast.error(e));

  return (
    <>
      <PageHeader title="Transactions" description={full ? "Every ledger entry in this home." : "Your ledger entries."} actions={<Button icon={Download} onClick={exportCsv}>Export CSV</Button>} />
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <div className="input-group" style={{ width: 220 }}><Search /><Input placeholder="Search description" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={filters.type} onChange={(e) => setFilter("type", e.target.value)} style={{ width: 170 }} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(ENTRY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} style={{ width: 140 }} aria-label="Status" options={[{ value: "", label: "Any status" }, { value: "posted", label: "Posted" }, { value: "pending", label: "Pending" }, { value: "rejected", label: "Rejected" }]} />
        {full && (
          <Select value={filters.membershipId} onChange={(e) => setFilter("member", e.target.value)} style={{ width: 170 }} aria-label="Member">
            <option value="">All members</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        )}
        <Input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} style={{ width: 150 }} aria-label="From" />
        <Input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} style={{ width: 150 }} aria-label="To" />
      </div>
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.items.length ? (
          <EmptyState icon={ArrowLeftRight} title="No transactions" description="Payments, charges and adjustments appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th>{full && <th>Member</th>}<th>Details</th><th className="r">Amount</th><th /><th /></tr></thead>
              <tbody>
                {data.items.map((e) => (
                  <EntryRow key={e._id} e={e} currency={currency} showMember={full} {...(can("finance.record") ? actions : { onAttachment: actions.onAttachment })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.pages > 1 && (
          <div className="card-foot row between">
            <span className="text-xs muted">{data.total} entries · page {data.page} of {data.pages}</span>
            <div className="row">
              <Button size="sm" icon={ChevronLeft} disabled={data.page <= 1} onClick={() => setFilter("page", data.page - 1)} aria-label="Previous page" />
              <Button size="sm" icon={ChevronRight} disabled={data.page >= data.pages} onClick={() => setFilter("page", data.page + 1)} aria-label="Next page" />
            </div>
          </div>
        )}
      </Card>
      {actions.modal}
    </>
  );
}
