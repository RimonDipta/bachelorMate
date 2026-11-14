import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, ClipboardList, History, MoonStar, UserPlus, Utensils, Receipt, Calculator, CalendarRange, Lock } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { useT } from "../../i18n/I18nProvider";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Money, PageHeader, Stat, StatusBadge } from "../../components/ui";
import { fmtDay, mealTypeLabel, monthBounds, monthKey, monthLabel, money, num, shiftMonth } from "../../lib/format";

export function MealSummaryTable({ summary, currency, highlight }) {
  const t = useT();
  const types = summary.mealTypes;
  const showCharge = summary.members.some((m) => m.charge !== undefined);
  if (!summary.members.length) return <EmptyState icon={Utensils} title={t("meals.noneRecorded")} compact />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t("common.member")}</th>
            {types.map((mt) => <th key={mt.key} className="r hide-sm">{mealTypeLabel(mt)}</th>)}
            <th className="r">{t("meals.meals")}</th>
            <th className="r">{t("meals.guests")}</th>
            {showCharge && <th className="r">{t("meals.mealCost")}</th>}
          </tr>
        </thead>
        <tbody>
          {summary.members.map((m) => (
            <tr key={m.membership} style={m.membership === highlight ? { background: "var(--accent-soft)" } : undefined}>
              <td><div className="row"><Avatar user={m.user} size={24} /><span className="text-sm truncate">{m.user?.name}</span>{m.status && m.status !== "active" && <StatusBadge status={m.status} />}</div></td>
              {types.map((mt) => <td key={mt.key} className="r num hide-sm muted">{num(m.counts[mt.key] || 0)}</td>)}
              <td className="r num strong">{num(m.meals)}</td>
              <td className="r num">{m.guestMeals ? num(m.guestMeals) : <span className="subtle">{num(0)}</span>}</td>
              {showCharge && <td className="r">{m.charge === undefined ? <span className="subtle">—</span> : <Money value={m.charge} currency={currency} />}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="strong text-sm" style={{ padding: "10px 16px" }}>{t("common.total")}</td>
            {types.map((mt) => <td key={mt.key} className="r num hide-sm" style={{ padding: "10px 16px" }}>{num(summary.members.reduce((a, m) => a + (m.counts[mt.key] || 0), 0))}</td>)}
            <td className="r num strong" style={{ padding: "10px 16px" }}>{num(summary.memberMeals)}</td>
            <td className="r num strong" style={{ padding: "10px 16px" }}>{num(summary.guestMeals)}</td>
            {showCharge && <td className="r strong" style={{ padding: "10px 16px" }}><Money value={summary.totalExpense - summary.unallocated} currency={currency} /></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function MealStats({ s, currency, mine }) {
  const t = useT();
  return (
    <div className="grid-4">
      <Stat icon={Receipt} label={t("meals.mealExpenses")} value={money(s.totalExpense, currency)} hint={t("meals.groceriesHint", { amount: money(s.groceryExpense, currency) })} />
      <Stat icon={Utensils} label={t("meals.totalMeals")} value={s.chargeableMeals} hint={t("meals.memberGuestHint", { members: s.memberMeals, guests: s.guestMeals })} />
      <Stat icon={Calculator} label={t("meals.mealRate")} value={money(s.rate, currency)} hint={s.guestPricing === "fixed" ? t("meals.guestsFixed", { amount: money(s.guestFixedRate, currency) }) : t("meals.rateFormula")} />
      <Stat icon={CalendarRange} label={t("meals.yourMeals")} value={mine ? mine.meals + mine.guestMeals : 0} hint={mine?.charge !== undefined ? `≈ ${money(mine.charge, currency)}` : undefined} />
    </div>
  );
}

export default function Meals() {
  const { homeId, can, currency, membershipId } = useHome();
  const t = useT();
  const [month, setMonth] = useState(monthKey());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["meals", homeId, "summary", month], queryFn: () => api.get(`/homes/${homeId}/meals/summary`, { month }) });
  const { data: periods } = useQuery({ queryKey: ["meals", homeId, "periods"], queryFn: () => api.get(`/homes/${homeId}/meals/periods`) });
  const create = useAction(() => api.post(`/homes/${homeId}/meals/periods`, form), { invalidate: [["meals", homeId], ["dashboard", homeId]], success: t("meals.periodCreated"), onSuccess: () => setModal(false) });

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
        title={t("nav.meals")}
        description={t("meals.desc")}
        actions={
          <>
            <Link to={`${base}/requests?new=meal_off`} className="btn btn-secondary"><MoonStar size={16} /> {t("common.mealOff")}</Link>
            <Link to={`${base}/requests?new=guest_meal`} className="btn btn-secondary"><UserPlus size={16} /> {t("meals.guestMeal")}</Link>
            <Link to={`${base}/meals/daily`} className="btn btn-primary"><ClipboardList size={16} /> {can("meals.manage") ? t("meals.manageDaily") : t("daily.title")}</Link>
          </>
        }
      />
      <div className="row between wrap">
        <div className="row">
          <Button variant="secondary" icon={ChevronLeft} aria-label={t("common.prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))} />
          <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
          <Button variant="secondary" icon={ChevronRight} aria-label={t("common.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))} />
        </div>
        <Link to={`${base}/meals/history`} className="btn btn-ghost"><History size={16} /> {t("meals.myHistory")}</Link>
      </div>
      {isLoading ? <Card><LoadingBlock /></Card> : error ? <Card><ErrorState error={error} retry={refetch} /></Card> : (
        <>
          <MealStats s={s} currency={currency} mine={mine} />
          <Card title={t("meals.summaryFor", { month: monthLabel(month) })} actions={<Badge>{t("meals.liveEstimate")}</Badge>}>
            <MealSummaryTable summary={s} currency={currency} highlight={membershipId} />
          </Card>
        </>
      )}
      <Card title={t("meals.periods")} actions={can("meals.configure") && <Button size="sm" variant="primary" icon={Plus} onClick={openNew}>{t("meals.newPeriod")}</Button>}>
        {!periods ? <LoadingBlock rows={2} /> : periods.periods.length === 0 ? (
          <EmptyState icon={CalendarRange} title={t("meals.noPeriods")} description={t("meals.noPeriodsHint")} compact action={can("meals.configure") && <Button variant="primary" icon={Plus} onClick={openNew}>{t("meals.createFirstPeriod")}</Button>} />
        ) : (
          <div className="list">
            {periods.periods.map((p) => (
              <Link key={p._id} to={`${base}/meals/periods/${p._id}`} className="list-item">
                {p.status === "closed" ? <Lock size={16} className="subtle" /> : <CalendarRange size={16} className="subtle" />}
                <div className="grow">
                  <div className="strong text-sm">{p.name}</div>
                  <div className="text-xs muted">{fmtDay(p.startDay)} – {fmtDay(p.endDay)}{p.status === "closed" && p.snapshot ? ` · ${t("meals.rateIs", { amount: money(p.snapshot.rate, currency) })}` : ""}</div>
                </div>
                <StatusBadge status={p.status} />
                <ChevronRight size={16} className="subtle" />
              </Link>
            ))}
          </div>
        )}
      </Card>
      <FormModal open={modal} onClose={() => setModal(false)} title={t("meals.newPeriodTitle")} description={t("meals.newPeriodHint")} submitLabel={t("meals.createPeriod")} loading={create.isPending} onSubmit={() => create.mutate()}>
        <Field label={t("common.name")}><Input value={form.name || ""} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label={t("common.starts")}><Input type="date" value={form.startDay || ""} onChange={(e) => setForm({ ...form, startDay: e.target.value })} /></Field>
          <Field label={t("common.ends")}><Input type="date" value={form.endDay || ""} min={form.startDay} onChange={(e) => setForm({ ...form, endDay: e.target.value })} /></Field>
        </div>
      </FormModal>
    </div>
  );
}
