import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Repeat, MoreHorizontal, Pencil, Pause, Play, Trash2, CalendarClock, Landmark, Info } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { useT } from "../../i18n/I18nProvider";
import { getLanguage, localeTag, translate } from "../../i18n";
import { Alert, Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, PageHeader, Segmented, Select, StatusBadge, Textarea } from "../../components/ui";
import SplitEditor, { allocationToSplit, emptySplit, splitError, splitToAllocation } from "../../components/SplitEditor";
import { CATEGORY_LABEL, addDays, fmtDay, localDay, money } from "../../lib/format";
import { minorToInput, parseMinor } from "../../lib/money";

const CATEGORIES = ["rent", "utilities", "internet", "cleaning", "maintenance", "other"];
// 1 Jan 2023 was a Sunday, so day i of that week is weekday i.
const weekdayName = (i) => new Date(Date.UTC(2023, 0, 1 + Number(i))).toLocaleDateString(localeTag(), { weekday: "long", timeZone: "UTC" });
const englishOrdinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const ordinal = (n) => (getLanguage() === "en" ? englishOrdinal(n) : translate("recurring.dayOrdinal", { n }));
const scheduleText = (t) => (t.frequency === "weekly" ? translate("recurring.everyWeekday", { day: weekdayName(t.weekday) }) : translate("recurring.monthlyOn", { day: ordinal(t.dayOfMonth) }));

/** First charge date for the form preview (same rule as the server). */
function firstCharge(f) {
  if (f.frequency === "weekly") {
    let d = f.startDay;
    for (let i = 0; i < 7 && new Date(`${d}T00:00:00Z`).getUTCDay() !== Number(f.weekday); i++) d = addDays(d, 1);
    return d;
  }
  const dd = String(f.dayOfMonth).padStart(2, "0");
  const thisMonth = `${f.startDay.slice(0, 7)}-${dd}`;
  if (thisMonth >= f.startDay) return thisMonth;
  const [y, m] = f.startDay.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-${dd}` : `${y}-${String(m + 1).padStart(2, "0")}-${dd}`;
}

const RecurringModal = (props) => (props.open ? <RecurringForm {...props} /> : null);

function RecurringForm({ open, onClose, template, members }) {
  const { homeId, currency } = useHome();
  const t = useT();
  const today = localDay();
  const [f, setF] = useState(() =>
    template
      ? { title: template.title, category: template.category, amount: minorToInput(template.amount), frequency: template.frequency, dayOfMonth: template.dayOfMonth, weekday: template.weekday, startDay: template.startDay, endDay: template.endDay || "", paidBy: template.paidBy || "", notes: template.notes || "", split: allocationToSplit(template.allocation) }
      : { title: t("recurring.defaultTitle"), category: "rent", amount: "", frequency: "monthly", dayOfMonth: 1, weekday: 5, startDay: today, endDay: "", paidBy: "", notes: "", split: emptySplit() }
  );
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const total = parseMinor(f.amount);
  const err = splitError(f.split, members, total);
  const first = f.startDay ? firstCharge(f) : null;
  const thisMonthMissed = !template && f.frequency === "monthly" && first && first.slice(0, 7) !== today.slice(0, 7);

  const save = useAction(
    () => {
      const body = {
        title: f.title.trim(),
        category: f.category,
        amount: f.amount,
        frequency: f.frequency,
        dayOfMonth: Number(f.dayOfMonth),
        weekday: Number(f.weekday),
        startDay: f.startDay,
        endDay: f.endDay || null,
        paidBy: f.paidBy || null,
        allocation: splitToAllocation(f.split, members),
        notes: f.notes || undefined,
      };
      return template ? api.patch(`/homes/${homeId}/recurring/${template._id}`, body) : api.post(`/homes/${homeId}/recurring`, body);
    },
    {
      invalidate: [["recurring", homeId], ["finance"], ["expenses"], ["dashboard", homeId], ["members", homeId]],
      success: (r) => (r.posted ? t("recurring.savedPosted", { count: r.posted }) : template ? t("recurring.updated") : t("recurring.created")),
      onSuccess: onClose,
    }
  );

  return (
    <FormModal open={open} onClose={onClose} size="lg" title={template ? t("recurring.editTitle") : t("recurring.newTitle")} description={t("recurring.formDesc")}
      submitLabel={template ? t("common.saveChanges") : t("recurring.create")} loading={save.isPending} disabled={!f.title.trim() || !total || Boolean(err)} onSubmit={() => save.mutate()}>
      <div className="form-grid">
        <Field label={t("common.name")}><Input value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder={t("recurring.namePlaceholder")} /></Field>
        <Field label={t("expenses.category")}><Select value={f.category} onChange={(e) => set({ category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} /></Field>
        <Field label={t("recurring.amountEach", { currency })}><Input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} autoFocus={!template} /></Field>
        <Field label={t("recurring.repeats")}>
          <Segmented label={t("recurring.frequency")} value={f.frequency} onChange={(frequency) => set({ frequency })} items={[{ value: "monthly", label: t("recurring.monthly") }, { value: "weekly", label: t("recurring.weekly") }]} />
        </Field>
        {f.frequency === "monthly" ? (
          <Field label={t("recurring.dayOfMonth")} hint={t("recurring.dayOfMonthHint")}>
            <Select value={String(f.dayOfMonth)} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }))} />
          </Field>
        ) : (
          <Field label={t("recurring.dayOfWeek")}><Select value={String(f.weekday)} onChange={(e) => set({ weekday: Number(e.target.value) })} options={Array.from({ length: 7 }, (_, i) => ({ value: String(i), label: weekdayName(i) }))} /></Field>
        )}
        <Field label={t("recurring.whoPaysBill")} hint={f.paidBy ? t("recurring.paidByHint") : t("recurring.fundHint")}>
          <Select value={f.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
            <option value="">{t("finance.homeFund")}</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        </Field>
        <Field label={t("common.starts")}><Input type="date" value={f.startDay} onChange={(e) => set({ startDay: e.target.value })} /></Field>
        <Field label={t("common.ends")} optional><Input type="date" min={f.startDay} value={f.endDay} onChange={(e) => set({ endDay: e.target.value })} /></Field>
      </div>

      {first && (
        <Alert tone="info" icon={CalendarClock}>
          {t("recurring.firstCharge")} <b>{fmtDay(first, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</b>
          {first <= today ? ` — ${t("recurring.postedOnSave")}` : "."}
          {thisMonthMissed && (
            <> <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 6 }} onClick={() => set({ startDay: `${today.slice(0, 7)}-01` })}>{t("recurring.chargeThisMonth")}</button></>
          )}
        </Alert>
      )}

      <Field label={t("recurring.whoPaysWhat")}>
        <SplitEditor value={f.split} onChange={(split) => set({ split })} members={members} totalMinor={total} currency={currency} />
      </Field>
      <Field label={t("common.notes")} optional><Textarea rows={2} value={f.notes} maxLength={500} onChange={(e) => set({ notes: e.target.value })} /></Field>
      {template && <p className="hint">{t("recurring.editHint")}</p>}
    </FormModal>
  );
}

export default function Recurring() {
  const { homeId, can, currency } = useHome();
  const t = useT();
  const manage = can("expenses.manage");
  const [params, setParams] = useSearchParams();
  // ?new=1 (from the setup checklist) opens the form straight away.
  const [modal, setModalState] = useState(() => (manage && params.get("new") === "1" ? {} : null)); // { template? }
  const setModal = (v) => {
    setModalState(v);
    if (!v && params.has("new")) setParams((p) => { p.delete("new"); return p; }, { replace: true });
  };
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["recurring", homeId], queryFn: () => api.get(`/homes/${homeId}/recurring`) });
  const inv = [["recurring", homeId], ["finance"], ["expenses"], ["dashboard", homeId]];
  const toggle = useAction((tpl) => api.post(`/homes/${homeId}/recurring/${tpl._id}/active`, { active: !tpl.active }), { invalidate: inv, success: (r) => (r.template.active ? t("recurring.resumed") : t("recurring.pausedToast")) });
  const del = useAction((tpl) => api.del(`/homes/${homeId}/recurring/${tpl._id}`), { invalidate: inv, success: t("recurring.deleted"), onSuccess: () => setDeleting(null) });

  const members = data?.members || [];
  const nameOf = Object.fromEntries(members.map((m) => [m._id, m.user]));
  const templates = data?.templates || [];
  const monthlyTotal = templates.filter((tpl) => tpl.active).reduce((a, tpl) => a + (tpl.frequency === "weekly" ? Math.round((tpl.amount * 52) / 12) : tpl.amount), 0);

  return (
    <>
      <PageHeader
        title={t("nav.recurring")}
        description={t("recurring.desc")}
        actions={manage && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>{t("recurring.newTitle")}</Button>}
      />
      {templates.length > 0 && (
        <Alert tone="neutral" icon={Info} style={{ marginBottom: 16 }}>
          {t("recurring.monthlyTotalBefore")}<b>{money(monthlyTotal, currency)}</b>{t("recurring.monthlyTotalAfter")}
        </Alert>
      )}
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !templates.length ? (
          <EmptyState icon={Repeat} title={t("recurring.none")} description={t("recurring.noneHint")}
            action={manage && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>{t("recurring.addRent")}</Button>} />
        ) : (
          <div className="list">
            {templates.map((tpl) => (
              <div key={tpl._id} className="list-item" style={{ alignItems: "flex-start", opacity: tpl.active ? 1 : 0.65 }}>
                <div className="timeline-dot" style={{ width: 36, height: 36 }}><Repeat /></div>
                <div className="grow col" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="strong">{tpl.title}</span>
                    <Badge>{CATEGORY_LABEL[tpl.category]}</Badge>
                    {!tpl.active && <StatusBadge status="cancelled" label={t("recurring.paused")} />}
                  </div>
                  <div className="text-sm muted">
                    <b className="num" style={{ color: "var(--text)" }}>{money(tpl.amount, currency)}</b> · {scheduleText(tpl)}
                    {tpl.active && tpl.nextDay && <> · {t("recurring.next", { day: fmtDay(tpl.nextDay) })}</>}
                    {tpl.endDay && <> · {t("recurring.until", { day: fmtDay(tpl.endDay) })}</>}
                    {" · "}{tpl.paidBy ? <>{t("recurring.paidBy", { name: nameOf[tpl.paidBy]?.name || t("recurring.aMember") })}</> : <><Landmark size={12} style={{ verticalAlign: -1 }} /> {t("finance.homeFund")}</>}
                  </div>
                  {tpl.allocation.mode === "none" ? (
                    <span className="text-xs muted">{t("recurring.nobodyCharged")}</span>
                  ) : (
                    <div className="row wrap" style={{ gap: 6 }}>
                      {tpl.perMember.map((p) => (
                        <span key={p.membership} className="badge" style={{ height: 24, paddingLeft: 3 }}>
                          <Avatar user={nameOf[p.membership]} size={18} />
                          {nameOf[p.membership]?.name.split(" ")[0]} <b className="num">{money(p.amount, currency)}</b>
                        </span>
                      ))}
                      {tpl.allocation.mode === "custom" && tpl.allocation.shares.some((s) => s.amount === 0) && <span className="text-xs muted">· {t("recurring.othersNothing")}</span>}
                    </div>
                  )}
                </div>
                {manage && (
                  <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={t("recurring.actionsFor", { title: tpl.title })} />}>
                    <MenuItem icon={Pencil} onClick={() => setModal({ template: tpl })}>{t("common.edit")}</MenuItem>
                    <MenuItem icon={tpl.active ? Pause : Play} onClick={() => toggle.mutate(tpl)}>{tpl.active ? t("recurring.pause") : t("recurring.resume")}</MenuItem>
                    <div className="menu-sep" />
                    <MenuItem icon={Trash2} danger onClick={() => setDeleting(tpl)}>{t("common.delete")}</MenuItem>
                  </Menu>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <RecurringModal open={Boolean(modal)} template={modal?.template} members={members} onClose={() => setModal(null)} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting)} loading={del.isPending} danger
        title={t("recurring.deleteTitle", { title: deleting?.title })} confirmLabel={t("common.delete")} description={t("recurring.deleteHint")} />
    </>
  );
}
