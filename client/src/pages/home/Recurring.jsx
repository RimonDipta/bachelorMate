import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Repeat, MoreHorizontal, Pencil, Pause, Play, Trash2, CalendarClock, Landmark, Info } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, PageHeader, Segmented, Select, StatusBadge, Textarea } from "../../components/ui";
import SplitEditor, { allocationToSplit, emptySplit, splitError, splitToAllocation } from "../../components/SplitEditor";
import { CATEGORY_LABEL, addDays, fmtDay, localDay, money } from "../../lib/format";
import { minorToInput, parseMinor } from "../../lib/money";

const CATEGORIES = ["rent", "utilities", "internet", "cleaning", "maintenance", "other"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const scheduleText = (t) => (t.frequency === "weekly" ? `Every ${WEEKDAYS[t.weekday]}` : `Monthly on the ${ordinal(t.dayOfMonth)}`);

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
  const today = localDay();
  const [f, setF] = useState(() =>
    template
      ? { title: template.title, category: template.category, amount: minorToInput(template.amount), frequency: template.frequency, dayOfMonth: template.dayOfMonth, weekday: template.weekday, startDay: template.startDay, endDay: template.endDay || "", paidBy: template.paidBy || "", notes: template.notes || "", split: allocationToSplit(template.allocation) }
      : { title: "House rent", category: "rent", amount: "", frequency: "monthly", dayOfMonth: 1, weekday: 5, startDay: today, endDay: "", paidBy: "", notes: "", split: emptySplit() }
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
      success: (r) => (r.posted ? `Saved — ${r.posted} charge${r.posted > 1 ? "s" : ""} posted now` : template ? "Recurring cost updated" : "Recurring cost created"),
      onSuccess: onClose,
    }
  );

  return (
    <FormModal open={open} onClose={onClose} size="lg" title={template ? "Edit recurring cost" : "New recurring cost"} description="Posted automatically on schedule and divided the way you choose."
      submitLabel={template ? "Save changes" : "Create recurring cost"} loading={save.isPending} disabled={!f.title.trim() || !total || Boolean(err)} onSubmit={() => save.mutate()}>
      <div className="form-grid">
        <Field label="Name"><Input value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. House rent" /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => set({ category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} /></Field>
        <Field label={`Amount each time (${currency})`}><Input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} autoFocus={!template} /></Field>
        <Field label="Repeats">
          <Segmented label="Frequency" value={f.frequency} onChange={(frequency) => set({ frequency })} items={[{ value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" }]} />
        </Field>
        {f.frequency === "monthly" ? (
          <Field label="Day of the month" hint="1–28, so it works in every month.">
            <Select value={String(f.dayOfMonth)} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }))} />
          </Field>
        ) : (
          <Field label="Day of the week"><Select value={String(f.weekday)} onChange={(e) => set({ weekday: Number(e.target.value) })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} /></Field>
        )}
        <Field label="Who pays the bill" hint={f.paidBy ? "They're credited the full amount on their account." : "Taken from the money members paid in."}>
          <Select value={f.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
            <option value="">Home fund</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.user.name}</option>)}
          </Select>
        </Field>
        <Field label="Starts"><Input type="date" value={f.startDay} onChange={(e) => set({ startDay: e.target.value })} /></Field>
        <Field label="Ends" optional><Input type="date" min={f.startDay} value={f.endDay} onChange={(e) => set({ endDay: e.target.value })} /></Field>
      </div>

      {first && (
        <Alert tone="info" icon={CalendarClock}>
          First charge: <b>{fmtDay(first, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</b>
          {first <= today ? " — posted as soon as you save." : "."}
          {thisMonthMissed && (
            <> <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 6 }} onClick={() => set({ startDay: `${today.slice(0, 7)}-01` })}>Charge this month too</button></>
          )}
        </Alert>
      )}

      <Field label="Who pays what">
        <SplitEditor value={f.split} onChange={(split) => set({ split })} members={members} totalMinor={total} currency={currency} />
      </Field>
      <Field label="Notes" optional><Textarea rows={2} value={f.notes} maxLength={500} onChange={(e) => set({ notes: e.target.value })} /></Field>
      {template && <p className="hint">Changes apply to future charges. Charges already posted stay as they are — edit or void them from Expenses if needed.</p>}
    </FormModal>
  );
}

export default function Recurring() {
  const { homeId, can, currency } = useHome();
  const manage = can("expenses.manage");
  const [modal, setModal] = useState(null); // { template? }
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["recurring", homeId], queryFn: () => api.get(`/homes/${homeId}/recurring`) });
  const inv = [["recurring", homeId], ["finance"], ["expenses"], ["dashboard", homeId]];
  const toggle = useAction((t) => api.post(`/homes/${homeId}/recurring/${t._id}/active`, { active: !t.active }), { invalidate: inv, success: (r) => (r.template.active ? "Resumed" : "Paused — no new charges until resumed") });
  const del = useAction((t) => api.del(`/homes/${homeId}/recurring/${t._id}`), { invalidate: inv, success: "Recurring cost deleted", onSuccess: () => setDeleting(null) });

  const members = data?.members || [];
  const nameOf = Object.fromEntries(members.map((m) => [m._id, m.user]));
  const templates = data?.templates || [];
  const monthlyTotal = templates.filter((t) => t.active).reduce((a, t) => a + (t.frequency === "weekly" ? Math.round((t.amount * 52) / 12) : t.amount), 0);

  return (
    <>
      <PageHeader
        title="Recurring costs"
        description="Rent, internet, cleaner and other bills that repeat — charged automatically, divided your way."
        actions={manage && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>New recurring cost</Button>}
      />
      {templates.length > 0 && (
        <Alert tone="neutral" icon={Info} style={{ marginBottom: 16 }}>
          About <b>{money(monthlyTotal, currency)}</b> a month in active recurring costs. Each charge lands on members' accounts, so “My account” always shows what they need to pay.
        </Alert>
      )}
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : !templates.length ? (
          <EmptyState icon={Repeat} title="No recurring costs yet" description="Set up rent or bills once — BachelorMate charges everyone on schedule and does the maths."
            action={manage && <Button variant="primary" icon={Plus} onClick={() => setModal({})}>Add house rent</Button>} />
        ) : (
          <div className="list">
            {templates.map((t) => (
              <div key={t._id} className="list-item" style={{ alignItems: "flex-start", opacity: t.active ? 1 : 0.65 }}>
                <div className="timeline-dot" style={{ width: 36, height: 36 }}><Repeat /></div>
                <div className="grow col" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="strong">{t.title}</span>
                    <Badge>{CATEGORY_LABEL[t.category]}</Badge>
                    {!t.active && <StatusBadge status="cancelled" label="paused" />}
                  </div>
                  <div className="text-sm muted">
                    <b className="num" style={{ color: "var(--text)" }}>{money(t.amount, currency)}</b> · {scheduleText(t)}
                    {t.active && t.nextDay && <> · next {fmtDay(t.nextDay)}</>}
                    {t.endDay && <> · until {fmtDay(t.endDay)}</>}
                    {" · "}{t.paidBy ? <>paid by {nameOf[t.paidBy]?.name || "a member"}</> : <><Landmark size={12} style={{ verticalAlign: -1 }} /> home fund</>}
                  </div>
                  {t.allocation.mode === "none" ? (
                    <span className="text-xs muted">Nobody is charged</span>
                  ) : (
                    <div className="row wrap" style={{ gap: 6 }}>
                      {t.perMember.map((p) => (
                        <span key={p.membership} className="badge" style={{ height: 24, paddingLeft: 3 }}>
                          <Avatar user={nameOf[p.membership]} size={18} />
                          {nameOf[p.membership]?.name.split(" ")[0]} <b className="num">{money(p.amount, currency)}</b>
                        </span>
                      ))}
                      {t.allocation.mode === "custom" && t.allocation.shares.some((s) => s.amount === 0) && <span className="text-xs muted">· others pay nothing</span>}
                    </div>
                  )}
                </div>
                {manage && (
                  <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={`Actions for ${t.title}`} />}>
                    <MenuItem icon={Pencil} onClick={() => setModal({ template: t })}>Edit</MenuItem>
                    <MenuItem icon={t.active ? Pause : Play} onClick={() => toggle.mutate(t)}>{t.active ? "Pause" : "Resume"}</MenuItem>
                    <div className="menu-sep" />
                    <MenuItem icon={Trash2} danger onClick={() => setDeleting(t)}>Delete</MenuItem>
                  </Menu>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <RecurringModal open={Boolean(modal)} template={modal?.template} members={members} onClose={() => setModal(null)} />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting)} loading={del.isPending} danger
        title={`Delete “${deleting?.title}”?`} confirmLabel="Delete" description="No more charges will be posted. Charges already posted stay in the books." />
    </>
  );
}
