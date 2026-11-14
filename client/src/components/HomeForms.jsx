/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button, Field, Input, Select, Switch } from "./ui";
import { CURRENCIES, HOME_TYPES, num } from "../lib/format";
import { useT } from "../i18n/I18nProvider";
import { translate } from "../i18n";

// Suggestions are written in the chosen language; the rule text saved is whatever the admin picks.
export const ruleSuggestions = () => [1, 2, 3, 4, 5].map((n) => translate(`homeForms.rule${n}`));

export function RulesEditor({ value = [], onChange }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const add = (text) => {
    const rule = text.trim();
    if (!rule || value.includes(rule) || value.length >= 30) return;
    onChange([...value, rule]);
    setDraft("");
  };
  const unused = ruleSuggestions().filter((s) => !value.includes(s));
  return (
    <div className="stack">
      {value.length > 0 && (
        <div className="card">
          {value.map((r, i) => (
            <div key={r} className="list-item">
              <GripVertical size={14} className="subtle" />
              <span className="subtle text-xs num">{num(i + 1)}.</span>
              <span className="grow text-sm">{r}</span>
              <Button size="sm" variant="ghost" icon={Trash2} aria-label={t("homeForms.removeRule")} onClick={() => onChange(value.filter((x) => x !== r))} />
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <Input placeholder={t("homeForms.rulePlaceholder")} aria-label={t("homeForms.rulePlaceholder")} value={draft} maxLength={300} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(draft))} />
        <Button icon={Plus} onClick={() => add(draft)} disabled={!draft.trim()}>{t("homeForms.add")}</Button>
      </div>
      {unused.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="hint">{t("homeForms.suggestions")}</span>
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
  const t = useT();
  const [label, setLabel] = useState("");
  const update = (i, patch) => onChange(value.map((mt, j) => (j === i ? { ...mt, ...patch } : mt)));
  const add = () => {
    let key = slug(label);
    while (value.some((mt) => mt.key === key)) key = `${key}_2`.slice(0, 24);
    onChange([...value, { key, label: label.trim(), weight: 1, enabled: true }]);
    setLabel("");
  };
  return (
    <div className="stack">
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr><th>{t("homeForms.meal")}</th><th style={{ width: 120 }}>{t("homeForms.countsAs")}</th><th className="c" style={{ width: 80 }}>{t("homeForms.active")}</th><th style={{ width: 48 }} /></tr>
          </thead>
          <tbody>
            {value.map((mt, i) => (
              <tr key={mt.key}>
                <td><Input value={mt.label} maxLength={30} onChange={(e) => update(i, { label: e.target.value })} aria-label={t("homeForms.mealName")} /></td>
                <td>
                  <Select value={String(mt.weight)} onChange={(e) => update(i, { weight: Number(e.target.value) })} aria-label={t("homeForms.mealWeight")} options={[0.25, 0.5, 0.75, 1, 1.5, 2].map((w) => ({ value: String(w), label: t("homeForms.weightMeal", { w }) }))} />
                </td>
                <td className="c"><Switch checked={mt.enabled} onChange={(v) => update(i, { enabled: v })} label={t("homeForms.typeActive", { label: mt.label })} /></td>
                <td>
                  {!lockedKeys.includes(mt.key) && value.length > 1 && <Button size="sm" variant="ghost" icon={Trash2} aria-label={t("homeForms.removeMealType")} onClick={() => onChange(value.filter((_, j) => j !== i))} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.length < 8 && (
        <div className="row">
          <Input placeholder={t("homeForms.addMealType")} aria-label={t("homeForms.addMealType")} value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && label.trim() && (e.preventDefault(), add())} />
          <Button icon={Plus} onClick={add} disabled={!label.trim()}>{t("homeForms.add")}</Button>
        </div>
      )}
      <p className="hint">{t("homeForms.weightsHint")}</p>
    </div>
  );
}

const TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Karachi", "Asia/Kathmandu", "Asia/Colombo", "Asia/Dubai", "Asia/Riyadh", "Asia/Kuala_Lumpur", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Australia/Sydney", "UTC"];

export function HomeBasicsFields({ values, set, errors = {}, showLocale = true }) {
  const t = useT();
  return (
    <div className="form-grid">
      <Field label={t("homeForms.homeName")} className="full" error={errors.name}>
        <Input value={values.name} maxLength={80} placeholder={t("homeForms.homeNamePlaceholder")} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label={t("homeForms.homeType")}>
        <Select value={values.type} onChange={(e) => set("type", e.target.value)} options={Object.entries(HOME_TYPES).map(([value, label]) => ({ value, label }))} />
      </Field>
      <Field label={t("homeForms.address")} optional>
        <Input value={values.address} maxLength={300} placeholder={t("homeForms.addressPlaceholder")} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label={t("forms.description")} optional className="full">
        <Input value={values.description} maxLength={1000} placeholder={t("homeForms.descriptionPlaceholder")} onChange={(e) => set("description", e.target.value)} />
      </Field>
      {showLocale && (
        <>
          <Field label={t("homeForms.currency")} hint={t("homeForms.currencyHint")}>
            <Select value={values.currency} onChange={(e) => set("currency", e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label={t("homeForms.timezone")} hint={t("homeForms.timezoneHint")}>
            <Select value={values.timezone} onChange={(e) => set("timezone", e.target.value)} options={[...new Set([values.timezone, ...TIMEZONES])].map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))} />
          </Field>
        </>
      )}
    </div>
  );
}
