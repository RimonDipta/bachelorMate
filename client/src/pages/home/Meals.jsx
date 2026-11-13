import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, ClipboardList, History, MoonStar, UserPlus, Utensils, Receipt, Calculator, CalendarRange, Lock } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Money, PageHeader, Stat, StatusBadge } from "../../components/ui";
import { fmtDay, monthBounds, monthKey, monthLabel, money, shiftMonth } from "../../lib/format";

export function MealSummaryTable({ summary, currency, highlight }) {
  const types = summary.mealTypes;
  const showCharge = summary.members.some((m) => m.charge !== undefined);
  if (!summary.members.length) return <EmptyState icon={Utensils} title="No meals recorded" compact />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Member</th>
            {types.map((t) => <th key={t.key} className="r hide-sm">{t.label}</th>)}
            <th className="r">Meals</th>
            <th className="r">Guests</th>
            {showCharge && <th className="r">Meal cost</th>}
          </tr>
        </thead>
        <tbody>
          {summary.members.map((m) => (
            <tr key={m.membership} style={m.membership === highlight ? { background: "var(--accent-soft)" } : undefined}>
              <td><div className="row"><Avatar user={m.user} size={24} /><span className="text-sm truncate">{m.user?.name}</span>{m.status && m.status !== "active" && <Badge>{m.status}</Badge>}</div></td>
              {types.map((t) => <td key={t.key} className="r num hide-sm muted">{m.counts[t.key] || 0}</td>)}
              <td className="r num strong">{m.meals}</td>
              <td className="r num">{m.guestMeals || <span className="subtle">0</span>}</td>
              {showCharge && <td className="r">{m.charge === undefined ? <span className="subtle">—</span> : <Money value={m.charge} currency={currency} />}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="strong text-sm" style={{ padding: "10px 16px" }}>Total</td>
            {types.map((t) => <td key={t.key} className="r num hide-sm" style={{ padding: "10px 16px" }}>{summary.members.reduce((a, m) => a + (m.counts[t.key] || 0), 0)}</td>)}
            <td className="r num strong" style={{ padding: "10px 16px" }}>{summary.memberMeals}</td>
            <td className="r num strong" style={{ padding: "10px 16px" }}>{summary.guestMeals}</td>
            {showCharge && <td className="r strong" style={{ padding: "10px 16px" }}><Money value={summary.totalExpense - summary.unallocated} currency={currency} /></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function MealStats({ s, currency, mine }) {
  return (
    <div className="grid-4">
      <Stat icon={Receipt} label="Meal expenses" value={money(s.totalExpense, currency)} hint={`${money(s.groceryExpense, currency)} groceries`} />
      <Stat icon={Utensils} label="Total meals" value={s.chargeableMeals} hint={`${s.memberMeals} member + ${s.guestMeals} guest`} />
      <Stat icon={Calculator} label="Meal rate" value={money(s.rate, currency)} hint={s.guestPricing === "fixed" ? `Guests at fixed ${money(s.guestFixedRate, currency)}` : "Expenses ÷ total meals"} />
      <Stat icon={CalendarRange} label="Your meals" value={mine ? mine.meals + mine.guestMeals : 0} hint={mine?.charge !== undefined ? `≈ ${money(mine.charge, currency)}` : undefined} />
    </div>
  );
}

export default function Meals() {
  const { homeId, can, currency, membershipId } = useHome();
  const [month, setMonth] = useState(monthKey());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["meals", homeId, "summary", month], queryFn: () => api.get(`/homes/${homeId}/meals/summary`, { month }) });
  const { data: periods } = useQuery({ queryKey: ["meals", homeId, "periods"], queryFn: () => api.get(`/homes/${homeId}/meals/periods`) });
  const create = useAction(() => api.post(`/homes/${homeId}/meals/periods`, form), { invalidate: [["meals", homeId], ["dashboard", homeId]], success: "Meal period created", onSuccess: () => setModal(false) });

  const openNew = () => {
    const b = monthBounds(month);
    setForm({ name: monthLabel(month), startDay: b.from, endDay: b.to });
    setModal(true);
  };
  const s = data?.summary;
  const mine = s?.members.find((m) => m.membership === membershipId);
  const base = `/h/${homeId}`;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Meals"
        description="Meal counts, costs and the running meal rate."
        actions={
          <>
            <Link to={`${base}/requests?new=meal_off`} className="btn btn-secondary"><MoonStar size={16} /> Meal off</Link>
            <Link to={`${base}/requests?new=guest_meal`} className="btn btn-secondary"><UserPlus size={16} /> Guest meal</Link>
            <Link to={`${base}/meals/daily`} className="btn btn-primary"><ClipboardList size={16} /> {can("meals.manage") ? "Manage daily meals" : "Daily meal list"}</Link>
          </>
        }
      />
      <div className="row between wrap">
        <div className="row">
          <Button variant="secondary" icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
          <Button variant="secondary" icon={ChevronRight} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
        <Link to={`${base}/meals/history`} className="btn btn-ghost"><History size={16} /> My meal history</Link>
      </div>
      {isLoading ? <Card><LoadingBlock /></Card> : error ? <Card><ErrorState error={error} retry={refetch} /></Card> : (
        <>
          <MealStats s={s} currency={currency} mine={mine} />
          <Card title={`Meal summary · ${monthLabel(month)}`} actions={<Badge>Live estimate</Badge>}>
            <MealSummaryTable summary={s} currency={currency} highlight={membershipId} />
          </Card>
        </>
      )}
      <Card title="Meal periods" actions={can("meals.configure") && <Button size="sm" variant="primary" icon={Plus} onClick={openNew}>New period</Button>}>
        {!periods ? <LoadingBlock rows={2} /> : periods.periods.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No meal periods yet" description="A meal period (usually a month) is closed at the end to post each member's meal cost to their account." compact action={can("meals.configure") && <Button variant="primary" icon={Plus} onClick={openNew}>Create the first period</Button>} />
        ) : (
          <div className="list">
            {periods.periods.map((p) => (
              <Link key={p._id} to={`${base}/meals/periods/${p._id}`} className="list-item">
                {p.status === "closed" ? <Lock size={16} className="subtle" /> : <CalendarRange size={16} className="subtle" />}
                <div className="grow">
                  <div className="strong text-sm">{p.name}</div>
                  <div className="text-xs muted">{fmtDay(p.startDay)} – {fmtDay(p.endDay)}{p.status === "closed" && p.snapshot ? ` · rate ${money(p.snapshot.rate, currency)}` : ""}</div>
                </div>
                <StatusBadge status={p.status} />
                <ChevronRight size={16} className="subtle" />
              </Link>
            ))}
          </div>
        )}
      </Card>
      <FormModal open={modal} onClose={() => setModal(false)} title="New meal period" description="Periods can't overlap. Close it at the end to post meal charges." submitLabel="Create period" loading={create.isPending} onSubmit={() => create.mutate()}>
        <Field label="Name"><Input value={form.name || ""} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Starts"><Input type="date" value={form.startDay || ""} onChange={(e) => setForm({ ...form, startDay: e.target.value })} /></Field>
          <Field label="Ends"><Input type="date" value={form.endDay || ""} min={form.startDay} onChange={(e) => setForm({ ...form, endDay: e.target.value })} /></Field>
        </div>
      </FormModal>
    </div>
  );
}
