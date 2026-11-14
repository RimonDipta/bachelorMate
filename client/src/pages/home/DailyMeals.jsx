import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Minus, Plus, Save, Wand2, Lock, CalendarDays, Rows3, Users, Undo2 } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { useT } from "../../i18n/I18nProvider";
import { Alert, Avatar, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Segmented, Badge } from "../../components/ui";
import { addDays, fmtDay, fmtDayLong, localDay, mealTotal, mealTypeLabel, num } from "../../lib/format";

function Counter({ value, onChange, disabled, dirty, label }) {
  const t = useT();
  return (
    <span className={`meal-count ${value ? "" : "zero"} ${dirty ? "dirty" : ""}`}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled || value <= 0} aria-label={t("daily.decrease", { label })}><Minus size={13} /></button>
      <span aria-label={label}>{num(value)}</span>
      <button type="button" onClick={() => onChange(Math.min(20, value + 1))} disabled={disabled} aria-label={t("daily.increase", { label })}><Plus size={13} /></button>
    </span>
  );
}

export default function DailyMeals() {
  const { homeId, can } = useHome();
  const t = useT();
  const editable = can("meals.manage");
  const [mode, setMode] = useState("day");
  const [day, setDay] = useState(localDay());
  const [showGuests, setShowGuests] = useState(false);
  const [edits, setEdits] = useState({}); // `${mid}|${field}|${key}` -> value
  const range = mode === "day" ? { from: day, to: day } : { from: addDays(day, -3), to: addDays(day, 3) };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["meals", homeId, "days", range.from, range.to], queryFn: () => api.get(`/homes/${homeId}/meals/days`, range) });

  const types = (data?.mealTypes || []).filter((mt) => mt.enabled);
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
    { invalidate: [["meals", homeId], ["dashboard", homeId]], success: t("daily.saved"), onSuccess: () => setEdits({}) }
  );
  const fill = useAction(() => api.post(`/homes/${homeId}/meals/generate`, { from: day, to: day }), { invalidate: [["meals", homeId]], success: (r) => (r.created ? t("daily.filled", { count: r.created }) : t("daily.allHaveEntry")) });

  const go = (n) => {
    if (Object.keys(edits).length && !window.confirm(t("daily.discardConfirm"))) return;
    setEdits({});
    setDay(addDays(day, n));
  };
  const dirtyCount = Object.keys(edits).length;
  const missing = data?.members.filter((m) => m.mealsEnabled !== false && !entryMap.has(`${m._id}|${day}`)).length || 0;

  const totals = types.map((mt) => ({
    key: mt.key,
    meals: (data?.members || []).reduce((a, m) => a + value(m._id, "counts", mt.key), 0),
    guests: (data?.members || []).reduce((a, m) => a + value(m._id, "guests", mt.key), 0),
  }));
  const guestLabel = (mt) => t("daily.typeGuests", { type: mealTypeLabel(mt) });
  const notFilled = (m) => (m.mealsEnabled === false ? t("daily.noMeals") : t("daily.notFilled"));

  return (
    <div className="stack-lg">
      <PageHeader
        title={t("daily.title")}
        description={editable ? t("daily.descEditable") : t("daily.descReadonly")}
        actions={<Segmented label={t("daily.view")} value={mode} onChange={(m) => { setEdits({}); setMode(m); }} items={[{ value: "day", label: t("daily.day"), icon: Rows3 }, { value: "week", label: t("daily.week"), icon: CalendarDays }]} />}
      />
      <div className="row between wrap">
        <div className="row">
          <Button icon={ChevronLeft} aria-label={t("common.previous")} onClick={() => go(mode === "day" ? -1 : -7)} />
          <Input type="date" value={day} onChange={(e) => e.target.value && (setEdits({}), setDay(e.target.value))} style={{ width: 160 }} aria-label={t("common.date")} />
          <Button icon={ChevronRight} aria-label={t("common.next")} onClick={() => go(mode === "day" ? 1 : 7)} />
          {day !== localDay() && <Button variant="ghost" onClick={() => { setEdits({}); setDay(localDay()); }}>{t("common.today")}</Button>}
        </div>
        {mode === "day" && (
          <div className="row wrap">
            <Button variant="ghost" icon={Users} onClick={() => setShowGuests(!showGuests)} aria-pressed={showGuests}>{showGuests ? t("daily.hideGuests") : t("daily.showGuests")}</Button>
            {canEdit && missing > 0 && <Button icon={Wand2} onClick={() => fill.mutate()} loading={fill.isPending}>{t("daily.fillFromDefaults", { count: missing })}</Button>}
          </div>
        )}
      </div>
      {closed && <Alert tone="neutral" icon={Lock}>{t("daily.closedDay", { name: closed.name })}</Alert>}

      <Card title={mode === "day" ? fmtDayLong(day) : `${fmtDay(range.from)} – ${fmtDay(range.to)}`} actions={mode === "day" && <Badge>{t("daily.mealsCount", { count: totals.reduce((a, x) => a + x.meals, 0) })} · {t("daily.guestsCount", { count: totals.reduce((a, x) => a + x.guests, 0) })}</Badge>}>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !data.members.length ? (
          <EmptyState icon={Users} title={t("daily.noMembers")} />
        ) : mode === "day" ? (
          <>
          {/* Phones: one card per member, big tap targets, no sideways scrolling. */}
          <ul className="meal-cards">
            {data.members.map((m) => (
              <li key={m._id} className="meal-card" style={m.mealsEnabled === false ? { opacity: 0.6 } : undefined}>
                <div className="row">
                  <Avatar user={m.user} size={28} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="text-sm strong truncate">{m.user.name}</div>
                    {!entryMap.has(`${m._id}|${day}`) && <div className="text-xs subtle">{notFilled(m)}</div>}
                  </div>
                </div>
                <div className="meal-card-grid">
                  {["counts", ...(showGuests ? ["guests"] : [])].flatMap((field) =>
                    types.map((mt) => {
                      const v = value(m._id, field, mt.key);
                      const label = field === "guests" ? guestLabel(mt) : mealTypeLabel(mt);
                      return (
                        <div key={`${field}-${mt.key}`} className="meal-card-cell">
                          <span className="text-xs muted truncate">{label}{field === "counts" && mt.weight !== 1 && <span className="subtle"> ×{num(mt.weight)}</span>}</span>
                          {canEdit ? (
                            <Counter value={v} onChange={(n) => setVal(m._id, field, mt.key, n)} dirty={`${m._id}|${field}|${mt.key}` in edits} label={`${m.user.name} ${label}`} />
                          ) : (
                            <span className={`meal-pill ${v ? "" : "off"}`}>{num(v)}</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="table-wrap meal-grid-wrap">
            <table className="table meal-grid">
              <thead>
                <tr>
                  <th>{t("common.member")}</th>
                  {types.map((mt) => <th key={mt.key} className="c">{mealTypeLabel(mt)}{mt.weight !== 1 && <span className="subtle"> ×{num(mt.weight)}</span>}</th>)}
                  {showGuests && types.map((mt) => <th key={`g-${mt.key}`} className="c">{guestLabel(mt)}</th>)}
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
                          {!entryMap.has(`${m._id}|${day}`) && <div className="text-xs subtle">{notFilled(m)}</div>}
                        </div>
                      </div>
                    </td>
                    {types.map((mt) => (
                      <td key={mt.key} className="cell">
                        {canEdit ? (
                          <Counter value={value(m._id, "counts", mt.key)} onChange={(v) => setVal(m._id, "counts", mt.key, v)} dirty={`${m._id}|counts|${mt.key}` in edits} label={`${m.user.name} ${mealTypeLabel(mt)}`} />
                        ) : (
                          <span className={`meal-pill ${value(m._id, "counts", mt.key) ? "" : "off"}`}>{num(value(m._id, "counts", mt.key))}</span>
                        )}
                      </td>
                    ))}
                    {showGuests && types.map((mt) => (
                      <td key={`g-${mt.key}`} className="cell">
                        {canEdit ? (
                          <Counter value={value(m._id, "guests", mt.key)} onChange={(v) => setVal(m._id, "guests", mt.key, v)} dirty={`${m._id}|guests|${mt.key}` in edits} label={`${m.user.name} ${guestLabel(mt)}`} />
                        ) : (
                          <span className={`meal-pill ${value(m._id, "guests", mt.key) ? "" : "off"}`}>{num(value(m._id, "guests", mt.key))}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="strong text-sm" style={{ padding: "10px 16px" }}>{t("common.total")}</td>
                  {totals.map((x) => <td key={x.key} className="c strong num">{num(x.meals)}</td>)}
                  {showGuests && totals.map((x) => <td key={`g-${x.key}`} className="c strong num">{num(x.guests)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.member")}</th>
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
                      return <td key={d} className="c">{n === null ? <span className="subtle">·</span> : <span className={`meal-pill ${n ? "" : "off"}`} title={types.map((mt) => `${mealTypeLabel(mt)}: ${num(e.counts[mt.key] || 0)}`).join(", ")}>{num(n)}{g ? `+${num(g)}` : ""}</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dirtyCount > 0 && (
        <div className="card row between save-bar">
          <span className="text-sm muted">{t("daily.unsaved", { count: dirtyCount })}</span>
          <div className="row">
            <Button variant="ghost" icon={Undo2} onClick={() => setEdits({})}>{t("common.discard")}</Button>
            <Button variant="primary" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>{t("daily.save")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
