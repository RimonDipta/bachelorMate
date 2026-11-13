import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Minus, Plus, Save, Wand2, Lock, CalendarDays, Rows3, Users, Undo2 } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Avatar, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Segmented, Badge } from "../../components/ui";
import { addDays, fmtDay, fmtDayLong, localDay, mealTotal, pluralize } from "../../lib/format";

function Counter({ value, onChange, disabled, dirty, label }) {
  return (
    <span className={`meal-count ${value ? "" : "zero"} ${dirty ? "dirty" : ""}`}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled || value <= 0} aria-label={`Decrease ${label}`}><Minus size={13} /></button>
      <span aria-label={label}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} disabled={disabled} aria-label={`Increase ${label}`}><Plus size={13} /></button>
    </span>
  );
}

export default function DailyMeals() {
  const { homeId, can } = useHome();
  const editable = can("meals.manage");
  const [mode, setMode] = useState("day");
  const [day, setDay] = useState(localDay());
  const [showGuests, setShowGuests] = useState(false);
  const [edits, setEdits] = useState({}); // `${mid}|${field}|${key}` -> value
  const range = mode === "day" ? { from: day, to: day } : { from: addDays(day, -3), to: addDays(day, 3) };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["meals", homeId, "days", range.from, range.to], queryFn: () => api.get(`/homes/${homeId}/meals/days`, range) });

  const types = (data?.mealTypes || []).filter((t) => t.enabled);
  const entryMap = useMemo(() => new Map((data?.entries || []).map((e) => [`${e.membership}|${e.day}`, e])), [data]);
  const closed = data?.periods?.find((p) => p.status === "closed" && day >= p.startDay && day <= p.endDay);
  const canEdit = editable && !closed && mode === "day";

  const value = (mid, field, key) => {
    const k = `${mid}|${field}|${key}`;
    if (k in edits) return edits[k];
    return entryMap.get(`${mid}|${day}`)?.[field]?.[key] || 0;
  };
  const setVal = (mid, field, key, v) => setEdits((e) => ({ ...e, [`${mid}|${field}|${key}`]: v }));

  const save = useAction(
    () => {
      const byMember = {};
      for (const [k, v] of Object.entries(edits)) {
        const [mid, field, key] = k.split("|");
        byMember[mid] ||= { membershipId: mid, day, counts: {}, guests: {} };
        byMember[mid][field][key] = v;
      }
      return api.put(`/homes/${homeId}/meals/entries`, { entries: Object.values(byMember) });
    },
    { invalidate: [["meals", homeId], ["dashboard", homeId]], success: "Meals saved", onSuccess: () => setEdits({}) }
  );
  const fill = useAction(() => api.post(`/homes/${homeId}/meals/generate`, { from: day, to: day }), { invalidate: [["meals", homeId]], success: (r) => (r.created ? `Filled ${r.created} member(s) from defaults` : "Everyone already has an entry") });

  const go = (n) => {
    if (Object.keys(edits).length && !window.confirm("Discard unsaved changes?")) return;
    setEdits({});
    setDay(addDays(day, n));
  };
  const dirtyCount = Object.keys(edits).length;
  const missing = data?.members.filter((m) => m.mealsEnabled !== false && !entryMap.has(`${m._id}|${day}`)).length || 0;

  const totals = types.map((t) => ({
    key: t.key,
    meals: (data?.members || []).reduce((a, m) => a + value(m._id, "counts", t.key), 0),
    guests: (data?.members || []).reduce((a, m) => a + value(m._id, "guests", t.key), 0),
  }));

  return (
    <div className="stack-lg">
      <PageHeader
        title="Daily meal list"
        description={editable ? "Set each member's meals for the day. Approved meal-offs and guest meals are applied automatically." : "Who's eating what, day by day."}
        actions={<Segmented label="View" value={mode} onChange={(m) => { setEdits({}); setMode(m); }} items={[{ value: "day", label: "Day", icon: Rows3 }, { value: "week", label: "Week", icon: CalendarDays }]} />}
      />
      <div className="row between wrap">
        <div className="row">
          <Button icon={ChevronLeft} aria-label="Previous" onClick={() => go(mode === "day" ? -1 : -7)} />
          <Input type="date" value={day} onChange={(e) => e.target.value && (setEdits({}), setDay(e.target.value))} style={{ width: 160 }} aria-label="Date" />
          <Button icon={ChevronRight} aria-label="Next" onClick={() => go(mode === "day" ? 1 : 7)} />
          {day !== localDay() && <Button variant="ghost" onClick={() => { setEdits({}); setDay(localDay()); }}>Today</Button>}
        </div>
        {mode === "day" && (
          <div className="row">
            <Button variant="ghost" icon={Users} onClick={() => setShowGuests(!showGuests)} aria-pressed={showGuests}>{showGuests ? "Hide guests" : "Show guests"}</Button>
            {canEdit && missing > 0 && <Button icon={Wand2} onClick={() => fill.mutate()} loading={fill.isPending}>Fill {missing} from defaults</Button>}
          </div>
        )}
      </div>
      {closed && <Alert tone="neutral" icon={Lock}>This day belongs to the closed period “{closed.name}”. It's locked to keep accounts accurate.</Alert>}

      <Card title={mode === "day" ? fmtDayLong(day) : `${fmtDay(range.from)} – ${fmtDay(range.to)}`} actions={mode === "day" && <Badge>{pluralize(totals.reduce((a, t) => a + t.meals, 0), "meal")} · {pluralize(totals.reduce((a, t) => a + t.guests, 0), "guest")}</Badge>}>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.members.length ? (
          <EmptyState icon={Users} title="No members" />
        ) : mode === "day" ? (
          <div className="table-wrap">
            <table className="table meal-grid">
              <thead>
                <tr>
                  <th>Member</th>
                  {types.map((t) => <th key={t.key} className="c">{t.label}{t.weight !== 1 && <span className="subtle"> ×{t.weight}</span>}</th>)}
                  {showGuests && types.map((t) => <th key={`g-${t.key}`} className="c">{t.label} guests</th>)}
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m._id} style={m.mealsEnabled === false ? { opacity: 0.6 } : undefined}>
                    <td>
                      <div className="row">
                        <Avatar user={m.user} size={26} />
                        <div style={{ minWidth: 0 }}>
                          <div className="text-sm truncate">{m.user.name}</div>
                          {!entryMap.has(`${m._id}|${day}`) && <div className="text-xs subtle">{m.mealsEnabled === false ? "No meals" : "Not filled"}</div>}
                        </div>
                      </div>
                    </td>
                    {types.map((t) => (
                      <td key={t.key} className="cell">
                        {canEdit ? (
                          <Counter value={value(m._id, "counts", t.key)} onChange={(v) => setVal(m._id, "counts", t.key, v)} dirty={`${m._id}|counts|${t.key}` in edits} label={`${m.user.name} ${t.label}`} />
                        ) : (
                          <span className={`meal-pill ${value(m._id, "counts", t.key) ? "" : "off"}`}>{value(m._id, "counts", t.key)}</span>
                        )}
                      </td>
                    ))}
                    {showGuests && types.map((t) => (
                      <td key={`g-${t.key}`} className="cell">
                        {canEdit ? (
                          <Counter value={value(m._id, "guests", t.key)} onChange={(v) => setVal(m._id, "guests", t.key, v)} dirty={`${m._id}|guests|${t.key}` in edits} label={`${m.user.name} ${t.label} guests`} />
                        ) : (
                          <span className={`meal-pill ${value(m._id, "guests", t.key) ? "" : "off"}`}>{value(m._id, "guests", t.key)}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="strong text-sm" style={{ padding: "10px 16px" }}>Total</td>
                  {totals.map((t) => <td key={t.key} className="c strong num">{t.meals}</td>)}
                  {showGuests && totals.map((t) => <td key={`g-${t.key}`} className="c strong num">{t.guests}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  {data.days.map((d) => (
                    <th key={d} className="c">
                      <button className="btn btn-ghost btn-sm" style={{ fontWeight: d === localDay() ? 700 : 500 }} onClick={() => { setDay(d); setMode("day"); }}>{fmtDay(d, { weekday: "short", day: "numeric" })}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m._id}>
                    <td><div className="row"><Avatar user={m.user} size={24} /><span className="text-sm truncate">{m.user.name}</span></div></td>
                    {data.days.map((d) => {
                      const e = entryMap.get(`${m._id}|${d}`);
                      const n = e ? mealTotal(e.counts, types) : null;
                      const g = e ? mealTotal(e.guests, types) : 0;
                      return <td key={d} className="c">{n === null ? <span className="subtle">·</span> : <span className={`meal-pill ${n ? "" : "off"}`} title={types.map((t) => `${t.label}: ${e.counts[t.key] || 0}`).join(", ")}>{n}{g ? `+${g}` : ""}</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dirtyCount > 0 && (
        <div className="card row between" style={{ position: "sticky", bottom: 16, padding: "10px 14px", boxShadow: "var(--shadow-lg)", zIndex: 5 }}>
          <span className="text-sm muted">{dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}</span>
          <div className="row">
            <Button variant="ghost" icon={Undo2} onClick={() => setEdits({})}>Discard</Button>
            <Button variant="primary" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save meals</Button>
          </div>
        </div>
      )}
    </div>
  );
}
