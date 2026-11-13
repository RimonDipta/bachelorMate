import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History, MoonStar } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { Button, Card, EmptyState, LoadingBlock, PageHeader, Stat } from "../../components/ui";
import { fmtDay, mealTotal, monthBounds, monthKey, monthLabel, shiftMonth } from "../../lib/format";

export default function MealHistory() {
  const { homeId } = useHome();
  const [month, setMonth] = useState(monthKey());
  const range = monthBounds(month);
  const { data, isLoading } = useQuery({ queryKey: ["meals", homeId, "mine", month], queryFn: () => api.get(`/homes/${homeId}/meals/mine`, range) });
  const types = data?.mealTypes || [];
  const entries = data?.entries || [];
  const total = entries.reduce((a, e) => a + mealTotal(e.counts, types), 0);
  const guests = entries.reduce((a, e) => a + mealTotal(e.guests, types), 0);
  const offDays = entries.filter((e) => mealTotal(e.counts, types) === 0).length;

  return (
    <div className="stack-lg">
      <PageHeader title="My meal history" description="Every meal recorded for you, day by day." actions={<Link className="btn btn-secondary" to={`/h/${homeId}/requests?new=meal_off`}><MoonStar size={16} /> Request meal off</Link>} />
      <div className="row">
        <Button icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
        <Button icon={ChevronRight} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>
      <div className="grid-3">
        <Stat label="My meals" value={total} hint="Weighted by meal type" />
        <Stat label="Guest meals" value={guests} />
        <Stat label="Days off" value={offDays} />
      </div>
      <Card>
        {isLoading ? <LoadingBlock /> : !entries.length ? <EmptyState icon={History} title="No meals this month" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th>{types.map((t) => <th key={t.key} className="c">{t.label}</th>)}<th className="c">Guests</th><th className="r">Meals</th></tr></thead>
              <tbody>
                {entries.map((e) => {
                  const n = mealTotal(e.counts, types);
                  const g = mealTotal(e.guests, types);
                  return (
                    <tr key={e.day}>
                      <td className="text-sm">{fmtDay(e.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                      {types.map((t) => <td key={t.key} className="c"><span className={`meal-pill ${e.counts[t.key] ? "" : "off"}`}>{e.counts[t.key] || 0}</span></td>)}
                      <td className="c num">{g || <span className="subtle">—</span>}</td>
                      <td className="r num strong">{n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
