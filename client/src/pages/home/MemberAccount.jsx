import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, HandCoins, SlidersHorizontal, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useT } from "../../i18n/I18nProvider";
import { Avatar, Button, Card, EmptyState, ErrorState, Money, PageHeader, PageSkeleton, Badge } from "../../components/ui";
import { money, monthLabel, rolesLabel } from "../../lib/format";
import { AdjustmentModal, PaymentModal } from "../../components/FinanceForms";
import { EntryRow, useEntryActions } from "./Transactions";

export default function MemberAccount({ self }) {
  const params = useParams();
  const t = useT();
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
  const monthRows = order.filter((type) => st.thisMonth[type]).map((type) => [type, st.thisMonth[type]]);
  const pending = entries.filter((e) => e.status === "pending");

  return (
    <div className="stack-lg">
      <PageHeader
        back={!self && <Link to={`/h/${homeId}/finance`} className="row text-sm muted" style={{ gap: 4 }}><ArrowLeft size={14} /> {t("nav.finance")}</Link>}
        title={self ? t("nav.myAccount") : member.user.name}
        description={self ? t("account.selfDesc") : `${rolesLabel(member.roles)}${member.room ? ` · ${t("account.room", { room: member.room })}` : ""}`}
        actions={
          <>
            {can("finance.record") && <Button icon={SlidersHorizontal} onClick={() => setModal("adjust")}>{t("common.adjustment")}</Button>}
            {(self || can("finance.record")) && <Button variant="primary" icon={HandCoins} onClick={() => setModal("pay")}>{can("finance.record") ? t("common.recordPayment") : t("common.submitPayment")}</Button>}
          </>
        }
      />
      <div className="bento">
        <Card className="span-5" pad>
          <div className="row-3">
            <Avatar user={member.user} size={44} />
            <div style={{ minWidth: 0 }}>
              <div className="text-xs muted">{self ? t("common.youNeedToPay") : t("account.needsToPay")}</div>
              <div className="stat-value" style={{ fontSize: "var(--text-3xl)" }}>{money(st.payable, currency)}</div>
            </div>
          </div>
          <p className="text-sm muted" style={{ marginTop: 12 }}>
            {st.payable > 0
              ? self ? t("account.payableSelf") : t("account.payableOther")
              : st.advance > 0
                ? t("account.advanceCovers", { amount: money(st.advance, currency) })
                : t("account.allSettled")}
          </p>
          {pending.length > 0 && <Badge tone="warning" style={{ marginTop: 8, height: "auto", whiteSpace: "normal" }}>{t("account.pendingPayments", { count: pending.length })}</Badge>}
        </Card>
        <Card className="span-7" title={t("account.howItAddsUp", { month: monthLabel(st.month) })}>
          <div className="card-body stack" style={{ gap: 8 }}>
            <div className="row between text-sm" style={{ gap: 12 }}>
              <span>{st.opening < 0 ? t("account.duesCarried") : st.opening > 0 ? t("account.advanceCarried") : t("account.carried")}</span>
              <Money value={st.opening} currency={currency} sign colored />
            </div>
            {monthRows.map(([type, v]) => (
              <div key={type} className="row between text-sm" style={{ gap: 12 }}><span>{t(`account.thisMonth.${type}`)}</span><Money value={v} currency={currency} sign colored /></div>
            ))}
            {monthRows.length === 0 && <p className="text-sm muted">{t("account.nothingThisMonth")}</p>}
            <hr className="divider" />
            <div className="row between text-sm"><span>{t("account.balanceNow")}</span><Money value={st.balance} currency={currency} sign colored /></div>
            <div className="row between strong"><span>{self ? t("common.youNeedToPay") : t("finance.toPay")}</span><span className="num">{money(st.payable, currency)}</span></div>
            <p className="hint">{t("account.signHint")}</p>
          </div>
        </Card>
      </div>
      <Card title={t("account.statement")} actions={<span className="text-xs muted">{t("account.entries", { count: entries.length })}</span>}>
        {!entries.length ? <EmptyState icon={FileText} title={t("account.noEntries")} description={t("account.noEntriesHint")} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("common.date")}</th><th>{t("common.details")}</th><th className="r">{t("common.amount")}</th><th className="r hide-sm">{t("common.balance")}</th><th /><th /></tr></thead>
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
