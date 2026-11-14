import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Button, Card, Field, FormModal, Input, Modal, PageHeader, Textarea, Badge } from "../../components/ui";
import { addDays, fmtDayLong, localDay, monthBounds, monthKey, monthLabel, num, parseDay, shiftMonth } from "../../lib/format";
import { useI18n } from "../../i18n/I18nProvider";
import { translateCalendar } from "../../i18n/serverText";

const KINDS = ["event", "payment", "departure", "meal", "absence", "announcement"];

export default function Calendar() {
  const { homeId, can } = useHome();
  const { t, locale } = useI18n();
  // 2 Jan 2023 was a Monday; the grid starts on Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2023, 0, 2 + i)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }));
  const [month, setMonth] = useState(monthKey());
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const b = monthBounds(month);
  // Grid starts on Monday.
  const first = parseDay(b.from);
  const start = addDays(b.from, -((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const visible = days[35] > b.to ? days.slice(0, 35) : days;
  const range = { from: visible[0], to: visible[visible.length - 1] };
  const { data } = useQuery({ queryKey: ["calendar", homeId, range.from], queryFn: () => api.get(`/homes/${homeId}/calendar`, range) });
  const items = data?.items || [];
  const on = (d) => items.filter((e) => d >= e.startDay && d <= (e.endDay || e.startDay));
  const inv = [["calendar", homeId], ["dashboard", homeId]];
  const save = useAction(() => {
    const body = { title: form.title, description: form.description || undefined, startDay: form.startDay, endDay: form.endDay || "", time: form.time || "" };
    return form.id ? api.patch(`/homes/${homeId}/calendar/events/${form.id}`, body) : api.post(`/homes/${homeId}/calendar/events`, body);
  }, { invalidate: inv, success: t("calendar.saved"), onSuccess: () => setForm(null) });
  const del = useAction((id) => api.del(`/homes/${homeId}/calendar/events/${id}`), { invalidate: inv, success: t("calendar.deleted"), onSuccess: () => setSelected(null) });
  const today = localDay();

  return (
    <>
      <PageHeader title={t("nav.calendar")} description={t("calendar.desc")}
        actions={can("calendar.manage") && <Button variant="primary" icon={Plus} onClick={() => setForm({ title: "", description: "", startDay: today, endDay: "", time: "" })}>{t("calendar.add")}</Button>} />
      <Card>
        <div className="card-head">
          <div className="row">
            <Button size="sm" icon={ChevronLeft} aria-label={t("common.prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))} />
            <h2 style={{ minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</h2>
            <Button size="sm" icon={ChevronRight} aria-label={t("common.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))} />
          </div>
          <div className="row wrap hide-sm" style={{ gap: 6 }}>
            {KINDS.map((k) => <span key={k} className={`cal-ev ${k}`} style={{ cursor: "default" }}>{t(`calendar.kinds.${k}`)}</span>)}
          </div>
        </div>
        <div className="cal">
          {weekdays.map((d) => <div key={d} className="cal-h">{d}</div>)}
          {visible.map((d) => {
            const evs = on(d);
            return (
              <div key={d} className={`cal-d ${d.slice(0, 7) !== month ? "out" : ""} ${d === today ? "today" : ""}`}
                onDoubleClick={() => can("calendar.manage") && setForm({ title: "", description: "", startDay: d, endDay: "", time: "" })}>
                <span className="cal-n">{num(Number(d.slice(8)))}</span>
                {evs.slice(0, 3).map((e) => <button key={e.id + d} className={`cal-ev ${e.kind}`} onClick={() => setSelected(e)} title={translateCalendar(e.title)}>{translateCalendar(e.title)}</button>)}
                {evs.length > 3 && <span className="text-xs subtle">{t("calendar.more", { n: evs.length - 3 })}</span>}
              </div>
            );
          })}
        </div>
      </Card>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={translateCalendar(selected?.title)} description={selected && t(`calendar.kinds.${selected.kind}`)}
        footer={selected?.editable && can("calendar.manage") && (
          <>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => del.mutate(selected.id)} loading={del.isPending}>{t("common.delete")}</Button>
            <Button onClick={() => { setForm({ id: selected.id, title: selected.title, description: selected.description || "", startDay: selected.startDay, endDay: selected.endDay !== selected.startDay ? selected.endDay : "", time: selected.time || "" }); setSelected(null); }}>{t("common.edit")}</Button>
          </>
        )}>
        {selected && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="text-sm">{fmtDayLong(selected.startDay)}{selected.endDay && selected.endDay !== selected.startDay ? ` → ${fmtDayLong(selected.endDay)}` : ""}{selected.time ? ` · ${selected.time}` : ""}</div>
            {selected.description && <p className="text-sm muted" style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>}
            <Badge>{t(`calendar.kinds.${selected.kind}`)}</Badge>
          </div>
        )}
      </Modal>
      <FormModal open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? t("calendar.editTitle") : t("calendar.newTitle")} loading={save.isPending} disabled={!form?.title?.trim()} onSubmit={() => save.mutate()}>
        <Field label={t("forms.title")}><Input value={form?.title || ""} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label={t("common.date")}><Input type="date" value={form?.startDay || ""} onChange={(e) => setForm({ ...form, startDay: e.target.value })} /></Field>
          <Field label={t("common.ends")} optional><Input type="date" min={form?.startDay} value={form?.endDay || ""} onChange={(e) => setForm({ ...form, endDay: e.target.value })} /></Field>
          <Field label={t("calendar.time")} optional><Input type="time" value={form?.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
        </div>
        <Field label={t("common.details")} optional><Textarea value={form?.description || ""} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </FormModal>
    </>
  );
}
