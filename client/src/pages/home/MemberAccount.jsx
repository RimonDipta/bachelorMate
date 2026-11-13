import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, HandCoins, SlidersHorizontal, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { Avatar, Button, Card, EmptyState, ErrorState, Money, PageHeader, PageSkeleton, Badge } from "../../components/ui";
import { ENTRY_LABEL, money, monthLabel, rolesLabel } from "../../lib/format";
import { AdjustmentModal, PaymentModal } from "../../components/FinanceForms";
import { EntryRow, useEntryActions } from "./Transactions";

export default function MemberAccount({ self }) {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const { homeId, membershipId, can, currency } = useHome();
  const mid = self ? membershipId : params.mid;
  const [modal, setModal] = useState(search.get("pay") ? "pay" : null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["finance", homeId, "account", mid], queryFn: () => api.get(`/homes/${homeId}/finance/accounts/${mid}`) });
  const actions = useEntryActions(homeId);
  const closeModal = () => {
    setModal(null);
    if (search.get("pay")) setSearch({});
  };

  if (isLoading) return <PageSkeleton />;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;
  const { member, statement: st, entries } = data;
  const order = ["payment", "reimbursement", "opening_balance", "adjustment", "meal_charge", "expense_share", "reversal"];
  const monthRows = order.filter((t) => st.thisMonth[t]).map((t) => [t, st.thisMonth[t]]);
  const pending = entries.filter((e) => e.status === "pending");

  return (
    <div className="stack-lg">
      <PageHeader
        back={!self && <Link to={`/h/${homeId}/finance`} className="row text-sm muted" style={{ gap: 4 }}><ArrowLeft size={14} /> Finance</Link>}
        title={self ? "My account" : member.user.name}
        description={self ? "Your statement in this home." : `${rolesLabel(member.roles)}${member.room ? ` · Room ${member.room}` : ""}`}
        actions={
          <>
            {can("finance.record") && <Button icon={SlidersHorizontal} onClick={() => setModal("adjust")}>Adjustment</Button>}
            {(self || can("finance.record")) && <Button variant="primary" icon={HandCoins} onClick={() => setModal("pay")}>{can("finance.record") ? "Record payment" : "Submit payment"}</Button>}
          </>
        }
      />
      <div className="bento">
        <Card className="span-5" pad>
          <div className="row-3">
            <Avatar user={member.user} size={44} />
            <div>
              <div className="text-xs muted">{self ? "You need to pay" : "Needs to pay"}</div>
              <div className="stat-value" style={{ fontSize: "var(--text-3xl)" }}>{money(st.payable, currency)}</div>
            </div>
          </div>
          <p className="text-sm muted" style={{ marginTop: 12 }}>
            {st.payable > 0
              ? `${self ? "Your" : "Their"} share of this month's costs plus anything still owed, minus any advance.`
              : st.advance > 0
                ? `Nothing to pay — ${money(st.advance, currency)} advance will cover upcoming charges.`
                : "All settled. Nothing to pay right now."}
          </p>
          {pending.length > 0 && <Badge tone="warning" style={{ marginTop: 8 }}>{pending.length} payment(s) awaiting confirmation — not counted yet</Badge>}
        </Card>
        <Card className="span-7" title={`How it adds up · ${monthLabel(st.month)}`}>
          <div className="card-body stack" style={{ gap: 8 }}>
            <div className="row between text-sm">
              <span>{st.opening < 0 ? "Dues carried from before" : st.opening > 0 ? "Advance carried from before" : "Carried from before"}</span>
              <Money value={st.opening} currency={currency} sign colored />
            </div>
            {monthRows.map(([t, v]) => (
              <div key={t} className="row between text-sm"><span>{ENTRY_LABEL[t]}{t === "expense_share" ? " (rent, bills…)" : t === "meal_charge" ? "s" : ""} this month</span><Money value={v} currency={currency} sign colored /></div>
            ))}
            {monthRows.length === 0 && <p className="text-sm muted">No charges or payments yet this month.</p>}
            <hr className="divider" />
            <div className="row between text-sm"><span>Balance now</span><Money value={st.balance} currency={currency} sign colored /></div>
            <div className="row between strong"><span>{self ? "You need to pay" : "To pay"}</span><span className="num">{money(st.payable, currency)}</span></div>
            <p className="hint">Payments and credits count +, charges count −. If the balance is below zero, that's the amount to pay; above zero is advance credit.</p>
          </div>
        </Card>
      </div>
      <Card title="Statement" actions={<span className="text-xs muted">{entries.length} entries</span>}>
        {!entries.length ? <EmptyState icon={FileText} title="No entries yet" description="Payments, meal charges and shared expenses will appear here." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Details</th><th className="r">Amount</th><th className="r hide-sm">Balance</th><th /><th /></tr></thead>
              <tbody>
                {entries.map((e) => <EntryRow key={e._id} e={e} currency={currency} {...(can("finance.record") ? actions : { onAttachment: actions.onAttachment })} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {actions.modal}
      <PaymentModal open={modal === "pay"} onClose={closeModal} membershipId={mid} />
      <AdjustmentModal open={modal === "adjust"} onClose={closeModal} membershipId={mid} />
    </div>
  );
}
