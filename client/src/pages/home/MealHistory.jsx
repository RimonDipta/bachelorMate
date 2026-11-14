import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, History, MoonStar } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { Button, Card, EmptyState, LoadingBlock, PageHeader, Stat } from "../../components/ui";
import { fmtDay, mealTotal, mealTypeLabel, monthBounds, monthKey, monthLabel, num, shiftMonth } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

export default function MealHistory() {
  const { homeId } = useHome();
  const t = useT();
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
      <PageHeader title={t("meals.myHistory")} description={t("mealHistory.desc")} actions={<Link className="btn btn-secondary" to={`/h/${homeId}/requests?new=meal_off`}><MoonStar size={16} /> {t("mealHistory.requestOff")}</Link>} />
      <div className="row">
        <Button icon={ChevronLeft} aria-label={t("common.prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))} />
        <span className="strong" style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
        <Button icon={ChevronRight} aria-label={t("common.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>
      <div className="grid-3">
        <Stat label={t("mealHistory.myMeals")} value={total} hint={t("mealHistory.weighted")} />
        <Stat label={t("mealHistory.guestMeals")} value={guests} />
        <Stat label={t("mealHistory.daysOff")} value={offDays} />
      </div>
      <Card>
        {isLoading ? <LoadingBlock /> : !entries.length ? <EmptyState icon={History} title={t("mealHistory.none")} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("common.date")}</th>{types.map((mt) => <th key={mt.key} className="c">{mealTypeLabel(mt)}</th>)}<th className="c">{t("meals.guests")}</th><th className="r">{t("meals.meals")}</th></tr></thead>
              <tbody>
                {entries.map((e) => {
                  const n = mealTotal(e.counts, types);
                  const g = mealTotal(e.guests, types);
                  return (
                    <tr key={e.day}>
                      <td className="text-sm">{fmtDay(e.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                      {types.map((mt) => <td key={mt.key} className="c"><span className={`meal-pill ${e.counts[mt.key] ? "" : "off"}`}>{num(e.counts[mt.key] || 0)}</span></td>)}
                      <td className="c num">{g ? num(g) : <span className="subtle">—</span>}</td>
                      <td className="r num strong">{num(n)}</td>
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
