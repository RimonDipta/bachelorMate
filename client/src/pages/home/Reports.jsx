import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileBarChart } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat, Tabs } from "../../components/ui";
import { CATEGORY_LABEL, money, monthKey, monthLabel, num, shiftMonth } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";
import { translateServer } from "../../i18n/serverText";

const REPORTS = ["monthly-financial", "member-payments", "meal-consumption", "expense-breakdown", "outstanding-dues", "guest-meals"];

function Summary({ kind, s, currency }) {
  const t = useT();
  if (kind === "monthly-financial") {
    return (
      <div className="grid-4">
        <Stat label={t("reports.totalExpenses")} value={money(s.totalExpenses, currency)} />
        <Stat label={t("reports.collected")} value={money(s.paymentsCollected, currency)} />
        <Stat label={t("reports.mealCharges")} value={money(s.mealCharges, currency)} />
        <Stat label={t("reports.sharedBills")} value={money(s.expenseShares, currency)} />
      </div>
    );
  }
  if (kind === "meal-consumption" || kind === "guest-meals") {
    return (
      <div className="grid-4">
        <Stat label={t("meals.mealExpenses")} value={money(s.totalExpense, currency)} />
        <Stat label={t("reports.memberMeals")} value={s.memberMeals} />
        <Stat label={t("mealHistory.guestMeals")} value={s.guestMeals} />
        <Stat label={t("meals.mealRate")} value={money(s.rate, currency)} />
      </div>
    );
  }
  if (kind === "member-payments") return <div className="grid-3"><Stat label={t("finance.collected")} value={money(s.total, currency)} /></div>;
  if (kind === "outstanding-dues") return <div className="grid-3"><Stat label={t("reports.totalOutstanding")} value={<span className={s.totalDue ? "neg" : ""}>{money(s.totalDue, currency)}</span>} /></div>;
  if (kind === "expense-breakdown") {
    const total = s.total || 1;
    return (
      <Card pad title={t("reports.breakdown")}>
        <div className="stack" style={{ gap: 12 }}>
          {Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="col" style={{ gap: 4 }}>
              <div className="row between text-sm"><span>{CATEGORY_LABEL[k] || k}</span><span className="num">{money(v, currency)} · {num(Number(((v / total) * 100).toFixed(1)))}%</span></div>
              <div className="bar-track"><span style={{ width: `${(v / total) * 100}%` }} /></div>
            </div>
          ))}
          {!Object.keys(s.byCategory).length && <p className="muted text-sm">{t("finance.noExpensesMonth")}</p>}
        </div>
      </Card>
    );
  }
  return null;
}

export default function Reports() {
  const { homeId, currency } = useHome();
  const t = useT();
  const toast = useToast();
  const [kind, setKind] = useState("monthly-financial");
  const [month, setMonth] = useState(monthKey());
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["reports", homeId, kind, month], queryFn: () => api.get(`/homes/${homeId}/reports/${kind}`, { month }) });
  const download = () => api.download(`/homes/${homeId}/reports/${kind}`, { month, format: "csv" }, `${kind}-${month}.csv`).catch((e) => toast.error(e));

  return (
    <div className="stack-lg">
      <PageHeader title={t("nav.reports")} description={t("reports.desc")} actions={<Button variant="primary" icon={Download} onClick={download}>{t("reports.downloadCsv")}</Button>} />
      <Tabs items={REPORTS.map((value) => ({ value, label: t(`reports.kinds.${value}`) }))} value={kind} onChange={setKind} />
      <div className="row" style={{ marginTop: -8 }}>
        <Button icon={ChevronLeft} aria-label={t("common.prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
        <Button icon={ChevronRight} aria-label={t("common.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>
      {isLoading ? <Card><LoadingBlock /></Card> : error ? <Card><ErrorState error={error} retry={refetch} /></Card> : (
        <>
          <Summary kind={kind} s={data.summary} currency={currency} />
          <Card title={t(`reports.kinds.${kind}`)}>
            {!data.rows.length ? <EmptyState icon={FileBarChart} title={t("reports.nothing")} description={t("reports.noData", { month: monthLabel(month) })} /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>{data.headers.map((h) => <th key={h}>{translateServer(h)}</th>)}</tr></thead>
                  <tbody>
                    {data.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`text-sm ${/^-?\d+(\.\d+)?$/.test(String(c)) ? "num" : ""}`}>{c == null ? "—" : typeof c === "number" || /^-?\d+(\.\d+)?$/.test(String(c)) ? num(Number(c)) : translateServer(String(c))}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
