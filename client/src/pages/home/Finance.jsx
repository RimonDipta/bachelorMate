import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { ChevronLeft, ChevronRight, HandCoins, Plus, Landmark, ArrowDownToLine, AlertCircle, PiggyBank, Receipt, BellRing, SlidersHorizontal, Wallet } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Button, Card, EmptyState, ErrorState, Money, PageHeader, PageSkeleton, Stat } from "../../components/ui";
import { CATEGORY_LABEL, money, monthKey, monthLabel, shiftMonth } from "../../lib/format";
import { AdjustmentModal, ExpenseModal, PaymentModal } from "../../components/FinanceForms";

const CAT_COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-6)", "var(--chart-7)", "var(--chart-5)", "var(--chart-8)", "var(--chart-2)"];

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: "8px 10px", boxShadow: "var(--shadow-md)", fontSize: 12 }}>
      {label && <div className="strong" style={{ marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="row between" style={{ gap: 16 }}>
          <span className="row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.payload.fill }} />{p.name}</span>
          <span className="num strong">{money(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Finance() {
  const { homeId, can, currency, membershipId } = useHome();
  const [month, setMonth] = useState(monthKey());
  const [modal, setModal] = useState(null);
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["finance", homeId, "overview", month], queryFn: () => api.get(`/homes/${homeId}/finance/overview`, { month }) });
  const remind = useAction(() => api.post(`/homes/${homeId}/finance/reminders`), { success: (r) => (r.reminded ? `Reminder sent to ${r.reminded} member(s)` : "Nobody has outstanding dues") });
  const base = `/h/${homeId}`;

  if (isLoading) return <PageSkeleton />;
  if (error) return <Card><ErrorState error={error} retry={refetch} /></Card>;
  const t = d.totals;
  const trend = d.trend.map((x) => ({ ...x, label: new Date(`${x.month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" }) }));
  const cats = Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ name: CATEGORY_LABEL[k] || k, value: v, fill: CAT_COLORS[i % CAT_COLORS.length] }));
  const axisTick = { fill: "var(--text-3)", fontSize: 11 };

  return (
    <div className="stack-lg">
      <PageHeader
        title="Finance"
        description="Where the home's money comes from and where it goes."
        actions={
          <>
            {can("finance.record") && <Button icon={SlidersHorizontal} onClick={() => setModal("adjust")}>Adjustment</Button>}
            <Button icon={HandCoins} onClick={() => setModal("pay")}>{can("finance.record") ? "Record payment" : "Submit payment"}</Button>
            {can("expenses.manage", "expenses.meal") && <Button variant="primary" icon={Plus} onClick={() => setModal("expense")}>Add expense</Button>}
          </>
        }
      />
      <div className="row">
        <Button icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
        <Button icon={ChevronRight} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>

      <div className="grid-4">
        <Stat icon={Wallet} label="You need to pay" value={money(d.mine.payable, currency)} hint={<Link to={`${base}/finance/me`}>{d.mine.balance > 0 ? `${money(d.mine.balance, currency)} advance` : d.mine.balance < 0 ? "Includes dues carried over" : "All settled"} · see why →</Link>} />
        <Stat icon={Landmark} label="Home fund" value={money(t.fundBalance, currency)} hint="Payments in − expenses paid from fund" />
        <Stat icon={Receipt} label="Spent this month" value={money(t.monthTotal, currency)} hint={`${money(t.monthMeal, currency)} meals · ${money(t.monthOther, currency)} other`} />
        <Stat icon={ArrowDownToLine} label="Collected this month" value={money(t.monthCollected, currency)} hint={`${money(t.collected, currency)} all time`} />
      </div>
      {d.full && (
        <div className="grid-2">
          <Stat icon={AlertCircle} label="Total outstanding dues" value={<span className={t.outstandingDues ? "neg" : ""}>{money(t.outstandingDues, currency)}</span>} hint="Sum of negative balances" />
          <Stat icon={PiggyBank} label="Total advance balances" value={<span className={t.advances ? "pos" : ""}>{money(t.advances, currency)}</span>} hint="Sum of positive balances" />
        </div>
      )}

      <div className="bento">
        <Card className="span-8" title="Last 6 months">
          <div className="card-body">
            <div className="chart-legend" style={{ marginBottom: 8 }}>
              <span><i style={{ background: "var(--chart-1)" }} />Meal expenses</span>
              <span><i style={{ background: "var(--chart-2)" }} />Other expenses</span>
              <span><i style={{ background: "var(--chart-4)" }} />Collected</span>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={trend} barGap={4} margin={{ left: -8, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => money(v, currency, { compact: true })} width={64} />
                  <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: "var(--surface-hover)" }} />
                  <Bar dataKey="meal" name="Meal expenses" stackId="e" fill="var(--chart-1)" radius={[0, 0, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="other" name="Other expenses" stackId="e" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="collected" name="Collected" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
        <Card className="span-4" title="Spending by category">
          {cats.length === 0 ? <EmptyState compact icon={Receipt} title="No expenses this month" /> : (
            <div className="card-body">
              <div style={{ height: 160 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={cats} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="var(--surface)">
                      {cats.map((c) => <Cell key={c.name} fill={c.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                {cats.map((c) => (
                  <div key={c.name} className="row between text-sm">
                    <span className="row" style={{ gap: 8 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: c.fill, display: "inline-block" }} />{c.name}</span>
                    <span className="num">{money(c.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {d.full && (
          <Card className="span-12" title="Member accounts" actions={can("finance.record") && <Button size="sm" variant="ghost" icon={BellRing} loading={remind.isPending} onClick={() => remind.mutate()}>Remind members with dues</Button>}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Member</th><th className="r hide-sm">Credits</th><th className="r hide-sm">Charges</th><th className="r">Balance</th><th className="r">To pay</th><th className="hide-sm">Position</th></tr></thead>
                <tbody>
                  {d.accounts.map((a) => (
                    <tr key={a.membership}>
                      <td><Link to={a.membership === membershipId ? `${base}/finance/me` : `${base}/finance/accounts/${a.membership}`} className="row" style={{ color: "inherit" }}><Avatar user={a.user} size={26} /><span className="text-sm">{a.user?.name}</span>{a.status !== "active" && <span className="badge">{a.status}</span>}</Link></td>
                      <td className="r num hide-sm">{money(a.credits, currency)}</td>
                      <td className="r num hide-sm">{money(a.debits, currency)}</td>
                      <td className="r"><Money value={a.balance} currency={currency} colored /></td>
                      <td className="r strong num">{a.payable > 0 ? money(a.payable, currency) : <span className="subtle">—</span>}</td>
                      <td className="hide-sm">{a.balance < 0 ? <span className="badge badge-danger">Due</span> : a.balance > 0 ? <span className="badge badge-success">Advance</span> : <span className="badge">Settled</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot hint">Balance = payments & credits − charges. To pay = the amount below zero (an advance already covers new charges).</div>
          </Card>
        )}
      </div>
      <PaymentModal open={modal === "pay"} onClose={() => setModal(null)} />
      <AdjustmentModal open={modal === "adjust"} onClose={() => setModal(null)} />
      <ExpenseModal open={modal === "expense"} onClose={() => setModal(null)} />
    </div>
  );
}
