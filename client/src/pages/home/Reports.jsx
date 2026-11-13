import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileBarChart } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Stat, Tabs } from "../../components/ui";
import { CATEGORY_LABEL, money, monthKey, monthLabel, shiftMonth } from "../../lib/format";

const REPORTS = [
  { value: "monthly-financial", label: "Monthly financial" },
  { value: "member-payments", label: "Member payments" },
  { value: "meal-consumption", label: "Meal consumption" },
  { value: "expense-breakdown", label: "Expense breakdown" },
  { value: "outstanding-dues", label: "Outstanding dues" },
  { value: "guest-meals", label: "Guest meals" },
];

function Summary({ kind, s, currency }) {
  if (kind === "monthly-financial") {
    return (
      <div className="grid-4">
        <Stat label="Total expenses" value={money(s.totalExpenses, currency)} />
        <Stat label="Payments collected" value={money(s.paymentsCollected, currency)} />
        <Stat label="Meal charges posted" value={money(s.mealCharges, currency)} />
        <Stat label="Shared bill charges" value={money(s.expenseShares, currency)} />
      </div>
    );
  }
  if (kind === "meal-consumption" || kind === "guest-meals") {
    return (
      <div className="grid-4">
        <Stat label="Meal expenses" value={money(s.totalExpense, currency)} />
        <Stat label="Member meals" value={s.memberMeals} />
        <Stat label="Guest meals" value={s.guestMeals} />
        <Stat label="Meal rate" value={money(s.rate, currency)} />
      </div>
    );
  }
  if (kind === "member-payments") return <div className="grid-3"><Stat label="Collected" value={money(s.total, currency)} /></div>;
  if (kind === "outstanding-dues") return <div className="grid-3"><Stat label="Total outstanding" value={<span className={s.totalDue ? "neg" : ""}>{money(s.totalDue, currency)}</span>} /></div>;
  if (kind === "expense-breakdown") {
    const total = s.total || 1;
    return (
      <Card pad title="Breakdown">
        <div className="stack" style={{ gap: 12 }}>
          {Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="col" style={{ gap: 4 }}>
              <div className="row between text-sm"><span>{CATEGORY_LABEL[k] || k}</span><span className="num">{money(v, currency)} · {((v / total) * 100).toFixed(1)}%</span></div>
              <div className="bar-track"><span style={{ width: `${(v / total) * 100}%` }} /></div>
            </div>
          ))}
          {!Object.keys(s.byCategory).length && <p className="muted text-sm">No expenses this month.</p>}
        </div>
      </Card>
    );
  }
  return null;
}

export default function Reports() {
  const { homeId, currency } = useHome();
  const toast = useToast();
  const [kind, setKind] = useState("monthly-financial");
  const [month, setMonth] = useState(monthKey());
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["reports", homeId, kind, month], queryFn: () => api.get(`/homes/${homeId}/reports/${kind}`, { month }) });
  const download = () => api.download(`/homes/${homeId}/reports/${kind}`, { month, format: "csv" }, `${kind}-${month}.csv`).catch((e) => toast.error(e));

  return (
    <div className="stack-lg">
      <PageHeader title="Reports" description="Monthly numbers you can export and share." actions={<Button variant="primary" icon={Download} onClick={download}>Download CSV</Button>} />
      <Tabs items={REPORTS} value={kind} onChange={setKind} />
      <div className="row" style={{ marginTop: -8 }}>
        <Button icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
        <Button icon={ChevronRight} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>
      {isLoading ? <Card><LoadingBlock /></Card> : error ? <Card><ErrorState error={error} retry={refetch} /></Card> : (
        <>
          <Summary kind={kind} s={data.summary} currency={currency} />
          <Card title={REPORTS.find((r) => r.value === kind).label}>
            {!data.rows.length ? <EmptyState icon={FileBarChart} title="Nothing to report" description={`No data for ${monthLabel(month)}.`} /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>{data.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`text-sm ${/^-?\d+(\.\d+)?$/.test(String(c)) ? "num" : ""}`}>{c ?? "—"}</td>)}</tr>)}
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
