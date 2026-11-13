/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button, Field, Input, Select, Switch } from "./ui";
import { CURRENCIES, HOME_TYPES } from "../lib/format";

export const RULE_SUGGESTIONS = [
  "Keep the kitchen and common areas clean after use",
  "Quiet hours after 11 PM",
  "Inform the meal manager before the meal-off deadline",
  "Guests staying overnight need prior notice",
  "Monthly dues must be paid by the due date",
];

export function RulesEditor({ value = [], onChange }) {
  const [draft, setDraft] = useState("");
  const add = (text) => {
    const t = text.trim();
    if (!t || value.includes(t) || value.length >= 30) return;
    onChange([...value, t]);
    setDraft("");
  };
  const unused = RULE_SUGGESTIONS.filter((s) => !value.includes(s));
  return (
    <div className="stack">
      {value.length > 0 && (
        <div className="card">
          {value.map((r, i) => (
            <div key={r} className="list-item">
              <GripVertical size={14} className="subtle" />
              <span className="subtle text-xs num">{i + 1}.</span>
              <span className="grow text-sm">{r}</span>
              <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove rule" onClick={() => onChange(value.filter((x) => x !== r))} />
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <Input placeholder="Write a house rule…" value={draft} maxLength={300} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(draft))} />
        <Button icon={Plus} onClick={() => add(draft)} disabled={!draft.trim()}>Add</Button>
      </div>
      {unused.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="hint">Suggestions:</span>
          {unused.map((s) => (
            <button key={s} type="button" className="badge" style={{ border: 0, cursor: "pointer" }} onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "m$1").slice(0, 24) || "meal";

export function MealTypesEditor({ value = [], onChange, lockedKeys = [] }) {
  const [label, setLabel] = useState("");
  const update = (i, patch) => onChange(value.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const add = () => {
    let key = slug(label);
    while (value.some((t) => t.key === key)) key = `${key}_2`.slice(0, 24);
    onChange([...value, { key, label: label.trim(), weight: 1, enabled: true }]);
    setLabel("");
  };
  return (
    <div className="stack">
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>Meal</th><th style={{ width: 120 }}>Counts as</th><th className="c" style={{ width: 80 }}>Active</th><th style={{ width: 48 }} /></tr>
          </thead>
          <tbody>
            {value.map((t, i) => (
              <tr key={t.key}>
                <td><Input value={t.label} maxLength={30} onChange={(e) => update(i, { label: e.target.value })} aria-label="Meal name" /></td>
                <td>
                  <Select value={String(t.weight)} onChange={(e) => update(i, { weight: Number(e.target.value) })} aria-label="Meal weight" options={[0.25, 0.5, 0.75, 1, 1.5, 2].map((w) => ({ value: String(w), label: `${w} meal` }))} />
                </td>
                <td className="c"><Switch checked={t.enabled} onChange={(v) => update(i, { enabled: v })} label={`${t.label} active`} /></td>
                <td>
                  {!lockedKeys.includes(t.key) && value.length > 1 && <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove meal type" onClick={() => onChange(value.filter((_, j) => j !== i))} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.length < 8 && (
        <div className="row">
          <Input placeholder="Add a meal type, e.g. Snacks" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && label.trim() && (e.preventDefault(), add())} />
          <Button icon={Plus} onClick={add} disabled={!label.trim()}>Add</Button>
        </div>
      )}
      <p className="hint">Weights let a lighter meal count less — e.g. breakfast as half a meal when calculating the meal rate. Used meal types can be deactivated but not deleted, so history stays accurate.</p>
    </div>
  );
}

const TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Karachi", "Asia/Kathmandu", "Asia/Colombo", "Asia/Dubai", "Asia/Riyadh", "Asia/Kuala_Lumpur", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Australia/Sydney", "UTC"];

export function HomeBasicsFields({ values, set, errors = {}, showLocale = true }) {
  return (
    <div className="form-grid">
      <Field label="Home name" className="full" error={errors.name}>
        <Input value={values.name} maxLength={80} placeholder="e.g. Green Villa Mess" onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Home type">
        <Select value={values.type} onChange={(e) => set("type", e.target.value)} options={Object.entries(HOME_TYPES).map(([value, label]) => ({ value, label }))} />
      </Field>
      <Field label="Address" optional>
        <Input value={values.address} maxLength={300} placeholder="House, road, area" onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Description" optional className="full">
        <Input value={values.description} maxLength={1000} placeholder="A short note for people joining" onChange={(e) => set("description", e.target.value)} />
      </Field>
      {showLocale && (
        <>
          <Field label="Currency" hint="Used for every amount in this home.">
            <Select value={values.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Timezone" hint="Decides when a day starts for meals and deadlines.">
            <Select value={values.timezone} onChange={(e) => set("timezone", e.target.value)} options={[...new Set([values.timezone, ...TIMEZONES])].map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
          </Field>
        </>
      )}
    </div>
  );
}
