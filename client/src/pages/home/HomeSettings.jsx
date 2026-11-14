import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Archive, ArchiveRestore, Trash2, LogOut, ScrollText } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Button, Card, Field, FormModal, Input, PageHeader, Select, SettingRow, Switch, Tabs, Textarea, ConfirmDialog } from "../../components/ui";
import { HomeBasicsFields, MealTypesEditor, RulesEditor } from "../../components/HomeForms";
import { ROLE_LABEL, toMajorString } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";
import { translateServer } from "../../i18n/serverText";

function SaveBar({ dirty, loading, onSave, onReset }) {
  const t = useT();
  if (!dirty) return null;
  return (
    <div className="card card-pad row between" style={{ position: "sticky", bottom: 16, zIndex: 5, boxShadow: "var(--shadow-lg)", padding: "10px 14px" }}>
      <span className="text-sm muted">{t("homeSettings.unsaved")}</span>
      <div className="row">
        <Button variant="ghost" onClick={onReset}>{t("common.discard")}</Button>
        <Button variant="primary" icon={Save} loading={loading} onClick={onSave}>{t("common.saveChanges")}</Button>
      </div>
    </div>
  );
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

function useDraft(source) {
  const [draft, setDraft] = useState(source);
  const [prev, setPrev] = useState(source);
  if (source !== prev) {
    setPrev(source);
    setDraft(source);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  return [draft, setDraft, dirty, () => setDraft(source)];
}

function GeneralTab() {
  const { home, homeId, can } = useHome();
  const t = useT();
  const source = useMemo(() => pick(home, ["name", "type", "address", "description", "currency", "timezone"]), [home]);
  const [draft, setDraft, dirty, reset] = useDraft(source);
  const save = useAction(() => api.patch(`/homes/${homeId}`, { ...draft, address: draft.address || undefined, description: draft.description || undefined }), { invalidate: [["home", homeId], ["homes"]], success: t("homeSettings.updated") });
  const editable = can("home.manage");
  return (
    <div className="stack">
      <Card pad title={t("homeSettings.details")}>
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
          <HomeBasicsFields values={{ ...draft, address: draft.address || "", description: draft.description || "" }} set={(k, v) => setDraft({ ...draft, [k]: v })} />
        </fieldset>
        {draft.currency !== home.currency && <Alert tone="warning" style={{ marginTop: 12 }}>{t("homeSettings.currencyWarning")}</Alert>}
      </Card>
      {editable && <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />}
    </div>
  );
}

const RULE_KEYS = ["rules", "departureNoticeDays", "paymentDueDay", "mealPolicy", "guestPolicy", "paymentPolicy", "requireApproval", "codeJoinEnabled", "allowMemberInvites"];

function RulesTab() {
  const { home, homeId, can } = useHome();
  const t = useT();
  const source = useMemo(() => pick(home.settings, RULE_KEYS), [home]);
  const [d, setD, dirty, reset] = useDraft(source);
  const set = (k, v) => setD({ ...d, [k]: v });
  const save = useAction(() => api.patch(`/homes/${homeId}/settings`, d), { invalidate: [["home", homeId]], success: t("homeSettings.saved") });
  if (!can("settings.manage")) {
    return (
      <Card pad title={<h2 className="row"><ScrollText size={15} /> {t("homeSettings.houseRules")}</h2>}>
        {home.settings.rules.length ? <ol className="rules-list">{home.settings.rules.map((r) => <li key={r}>{r}</li>)}</ol> : <p className="muted text-sm">{t("homeSettings.noRules")}</p>}
        <div className="stack" style={{ marginTop: 16 }}>
          {[[t("homeSettings.mealPolicy"), home.settings.mealPolicy], [t("homeSettings.guestPolicy"), home.settings.guestPolicy], [t("homeSettings.paymentPolicy"), home.settings.paymentPolicy]].filter(([, text]) => text).map(([l, text]) => <div key={l}><div className="strong text-sm">{l}</div><p className="text-sm muted">{text}</p></div>)}
          <p className="hint">{t("homeSettings.summary", { days: home.settings.departureNoticeDays, day: home.settings.paymentDueDay })}</p>
        </div>
      </Card>
    );
  }
  return (
    <div className="stack">
      <Card pad title={t("homeSettings.houseRules")}><RulesEditor value={d.rules} onChange={(r) => set("rules", r)} /></Card>
      <Card pad title={t("homeSettings.policies")}>
        <div className="form-grid">
          <Field label={t("homeSettings.noticeDays")} hint={t("homeSettings.noticeDaysHint")}>
            <Input type="number" min={0} max={180} value={d.departureNoticeDays} onChange={(e) => set("departureNoticeDays", Math.max(0, Math.min(180, Number(e.target.value) || 0)))} />
          </Field>
          <Field label={t("homeSettings.dueDay")} hint={t("homeSettings.dueDayHint")}>
            <Input type="number" min={1} max={28} value={d.paymentDueDay} onChange={(e) => set("paymentDueDay", Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />
          </Field>
          <Field label={t("homeSettings.paymentPolicy")} optional className="full"><Textarea value={d.paymentPolicy} maxLength={2000} onChange={(e) => set("paymentPolicy", e.target.value)} /></Field>
        </div>
      </Card>
      <Card pad title={t("homeSettings.joining")}>
        <SettingRow title={t("homeSettings.approveCode")} description={t("homeSettings.approveCodeHint")}><Switch checked={d.requireApproval} onChange={(v) => set("requireApproval", v)} label={t("homeSettings.approveCode")} /></SettingRow>
        <SettingRow title={t("homeSettings.codeJoin")} description={t("homeSettings.codeJoinHint")}><Switch checked={d.codeJoinEnabled} onChange={(v) => set("codeJoinEnabled", v)} label={t("homeSettings.codeJoin")} /></SettingRow>
        <SettingRow title={t("homeSettings.memberInvites")} description={t("homeSettings.memberInvitesHint")}><Switch checked={d.allowMemberInvites} onChange={(v) => set("allowMemberInvites", v)} label={t("homeSettings.memberInvites")} /></SettingRow>
      </Card>
      <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />
    </div>
  );
}

const MEAL_KEYS = ["mealTypes", "mealOffCutoff", "autoApproveMealOff", "autoMealPeriods", "autoFillMeals", "guestMealPricing", "guestMealFixedRate", "mealPolicy", "guestPolicy"];

function MealsTab() {
  const { home, homeId, can, currency } = useHome();
  const t = useT();
  const source = useMemo(() => ({ ...pick(home.settings, MEAL_KEYS), guestMealFixedRate: toMajorString(home.settings.guestMealFixedRate) || "0" }), [home]);
  const [d, setD, dirty, reset] = useDraft(source);
  const set = (k, v) => setD({ ...d, [k]: v });
  const save = useAction(() => api.patch(`/homes/${homeId}/settings`, { ...d, guestMealFixedRate: d.guestMealFixedRate || "0" }), { invalidate: [["home", homeId], ["meals"]], success: t("homeSettings.mealSaved") });
  const editable = can("meals.configure");
  return (
    <div className="stack">
      <Alert tone="neutral">{t("homeSettings.mealNote")}</Alert>
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <Card pad title={t("homeSettings.mealTypes")}><MealTypesEditor value={d.mealTypes} onChange={(m) => set("mealTypes", m)} lockedKeys={home.settings.mealTypes.map((mt) => mt.key)} /></Card>
        <Card pad title={t("homeSettings.requestsGuests")}>
          <div className="form-grid">
            <Field label={t("homeSettings.mealOffDeadline")} hint={t("homeSettings.mealOffDeadlineHint")}><Input type="time" value={d.mealOffCutoff} onChange={(e) => set("mealOffCutoff", e.target.value)} /></Field>
            <Field label={t("homeSettings.guestPricing")}>
              <Select value={d.guestMealPricing} onChange={(e) => set("guestMealPricing", e.target.value)} options={[{ value: "meal_rate", label: t("homeSettings.chargeRate") }, { value: "fixed", label: t("homeSettings.chargeFixed") }]} />
            </Field>
            {d.guestMealPricing === "fixed" && <Field label={t("homeSettings.fixedRate", { currency })}><Input inputMode="decimal" value={d.guestMealFixedRate} onChange={(e) => set("guestMealFixedRate", e.target.value)} /></Field>}
            <Field label={t("homeSettings.mealPolicy")} optional className="full"><Textarea value={d.mealPolicy} maxLength={2000} onChange={(e) => set("mealPolicy", e.target.value)} /></Field>
            <Field label={t("homeSettings.guestPolicy")} optional className="full"><Textarea value={d.guestPolicy} maxLength={2000} onChange={(e) => set("guestPolicy", e.target.value)} /></Field>
          </div>
          <SettingRow title={t("homeSettings.autoApprove")} description={t("homeSettings.autoApproveHint")}><Switch checked={d.autoApproveMealOff} onChange={(v) => set("autoApproveMealOff", v)} label={t("homeSettings.autoApprove")} disabled={!editable} /></SettingRow>
          <SettingRow title={t("homeSettings.autoFill")} description={t("homeSettings.autoFillHint")}><Switch checked={d.autoFillMeals !== false} onChange={(v) => set("autoFillMeals", v)} label={t("homeSettings.autoFill")} disabled={!editable} /></SettingRow>
          <SettingRow title={t("homeSettings.autoPeriods")} description={t("homeSettings.autoPeriodsHint")}><Switch checked={d.autoMealPeriods !== false} onChange={(v) => set("autoMealPeriods", v)} label={t("homeSettings.autoPeriods")} disabled={!editable} /></SettingRow>
        </Card>
      </fieldset>
      {editable && <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />}
    </div>
  );
}

const PERM_ROLES = ["manager", "meal_manager", "member"];

function PermissionsTab() {
  const { home, homeId } = useHome();
  const t = useT();
  const { data } = useQuery({ queryKey: ["perm-catalog"], queryFn: () => api.get("/homes/permissions/catalog") });
  const source = useMemo(
    () => (data ? Object.fromEntries(PERM_ROLES.map((r) => [r, home.settings.rolePermissions?.[r] || data.defaults[r]])) : null),
    [data, home]
  );
  const roles = PERM_ROLES;
  const [d, setD, dirty, reset] = useDraft(source);
  const save = useAction(() => api.patch(`/homes/${homeId}/settings`, { rolePermissions: d }), { invalidate: [["home", homeId]], success: t("homeSettings.permsUpdated") });
  if (!data || !d) return null;
  const perms = Object.entries(data.permissions).filter(([p]) => !data.adminOnly.includes(p));
  const toggle = (role, p) => setD({ ...d, [role]: d[role].includes(p) ? d[role].filter((x) => x !== p) : [...d[role], p] });
  return (
    <div className="stack">
      <Card title={t("homeSettings.rolePerms")} actions={<Button size="sm" variant="ghost" onClick={() => setD(data.defaults && Object.fromEntries(roles.map((r) => [r, data.defaults[r]])))}>{t("homeSettings.resetDefaults")}</Button>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t("homeSettings.permission")}</th>{roles.map((r) => <th key={r} className="c">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {perms.map(([p, label]) => (
                <tr key={p}>
                  <td className="text-sm">{translateServer(label)}</td>
                  {roles.map((r) => (
                    <td key={r} className="c"><input type="checkbox" style={{ accentColor: "var(--accent)", width: 16, height: 16 }} checked={d[r].includes(p)} onChange={() => toggle(r, p)} aria-label={t("homeSettings.permFor", { perm: translateServer(label), role: ROLE_LABEL[r] })} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot hint">{t("homeSettings.adminAlways")}</div>
      </Card>
      <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />
    </div>
  );
}

function DangerTab() {
  const { home, homeId, isAdmin, archived } = useHome();
  const navigate = useNavigate();
  const t = useT();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const after = async () => {
    await qc.invalidateQueries({ queryKey: ["homes"] });
    navigate("/homes");
  };
  const archive = useAction(() => api.post(`/homes/${homeId}/${archived ? "unarchive" : "archive"}`), { invalidate: [["home", homeId], ["homes"]], success: archived ? t("homeSettings.restored") : t("homeSettings.archivedToast"), onSuccess: () => setModal(null) });
  const del = useAction(() => api.del(`/homes/${homeId}`, { confirmName }), { success: t("homeSettings.deleted"), onSuccess: after });
  const leave = useAction(() => api.post(`/homes/${homeId}/leave`), { success: t("homeSettings.leftHome", { home: home.name }), onSuccess: after });
  const notice = home.settings.departureNoticeDays;
  return (
    <div className="stack">
      {!isAdmin && (
        <Card pad title={t("homeSettings.leaveTitle")}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <p className="text-sm muted grow">{notice > 0 ? t("homeSettings.leaveNotice", { count: notice }) : t("homeSettings.leaveNow")}</p>
            {notice > 0 ? <Link className="btn btn-secondary" to={`/h/${homeId}/requests?new=departure`}><LogOut size={16} /> {t("requests.requestDeparture")}</Link> : <Button variant="danger-ghost" icon={LogOut} onClick={() => setModal("leave")}>{t("homeSettings.leaveButton")}</Button>}
          </div>
        </Card>
      )}
      {isAdmin && (
        <>
          <Alert tone="neutral">{t("homeSettings.ownerLeave")}</Alert>
          <Card pad title={archived ? t("homeSettings.restoreTitle") : t("homeSettings.archiveTitle")}>
            <div className="row between wrap" style={{ gap: 12 }}>
              <p className="text-sm muted grow">{archived ? t("homeSettings.restoreHint") : t("homeSettings.archiveHint")}</p>
              <Button icon={archived ? ArchiveRestore : Archive} onClick={() => setModal("archive")}>{archived ? t("homeSettings.restore") : t("homeSettings.archive")}</Button>
            </div>
          </Card>
          <Card pad title={t("homeSettings.deleteTitle")} style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))" }}>
            <div className="row between wrap" style={{ gap: 12 }}>
              <p className="text-sm muted grow">{t("homeSettings.deleteHint")}</p>
              <Button variant="danger" icon={Trash2} onClick={() => { setConfirmName(""); setModal("delete"); }}>{t("homeSettings.deleteTitle")}</Button>
            </div>
          </Card>
        </>
      )}
      <ConfirmDialog open={modal === "archive"} onClose={() => setModal(null)} onConfirm={() => archive.mutate()} loading={archive.isPending} title={archived ? t("homeSettings.restoreConfirm") : t("homeSettings.archiveConfirm")} confirmLabel={archived ? t("homeSettings.restore") : t("homeSettings.archive")} />
      <ConfirmDialog open={modal === "leave"} onClose={() => setModal(null)} onConfirm={() => leave.mutate()} loading={leave.isPending} danger title={t("homeSettings.leaveConfirm", { home: home.name })} confirmLabel={t("homeSettings.leaveButton")} description={t("homeSettings.leaveConfirmHint")} />
      <FormModal open={modal === "delete"} onClose={() => setModal(null)} danger title={t("homeSettings.deleteConfirm")} submitLabel={t("homeSettings.deleteForever")} loading={del.isPending} disabled={confirmName.trim() !== home.name} onSubmit={() => del.mutate()}>
        <Alert tone="danger">{t("homeSettings.deleteWarning")}</Alert>
        <Field label={<>{t("homeSettings.typeBefore")}<b>{home.name}</b>{t("homeSettings.typeAfter")}</>}><Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" /></Field>
      </FormModal>
    </div>
  );
}

export default function HomeSettings() {
  const { isAdmin, can } = useHome();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tabs = [
    { value: "general", label: t("homeSettings.tabs.general") },
    { value: "rules", label: t("homeSettings.tabs.rules") },
    { value: "meals", label: t("nav.meals") },
    ...(isAdmin ? [{ value: "permissions", label: t("homeSettings.tabs.permissions") }] : []),
    { value: "danger", label: isAdmin ? t("homeSettings.tabs.danger") : t("homeSettings.tabs.leave") },
  ];
  const tab = tabs.some((x) => x.value === params.get("tab")) ? params.get("tab") : can("home.manage") ? "general" : "rules";
  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader title={t("nav.homeSettings")} />
      <Tabs items={tabs} value={tab} onChange={(v) => setParams({ tab: v })} />
      {tab === "general" && <GeneralTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "meals" && <MealsTab />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "danger" && <DangerTab />}
    </div>
  );
}
