import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Archive, ArchiveRestore, Trash2, LogOut, ScrollText } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAction } from "../../lib/hooks";
import { Alert, Button, Card, Field, FormModal, Input, PageHeader, Select, SettingRow, Switch, Tabs, Textarea, ConfirmDialog } from "../../components/ui";
import { HomeBasicsFields, MealTypesEditor, RulesEditor } from "../../components/HomeForms";
import { toMajorString } from "../../lib/format";

function SaveBar({ dirty, loading, onSave, onReset }) {
  if (!dirty) return null;
  return (
    <div className="card card-pad row between" style={{ position: "sticky", bottom: 16, zIndex: 5, boxShadow: "var(--shadow-lg)", padding: "10px 14px" }}>
      <span className="text-sm muted">You have unsaved changes</span>
      <div className="row">
        <Button variant="ghost" onClick={onReset}>Discard</Button>
        <Button variant="primary" icon={Save} loading={loading} onClick={onSave}>Save changes</Button>
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
  const source = useMemo(() => pick(home, ["name", "type", "address", "description", "currency", "timezone"]), [home]);
  const [draft, setDraft, dirty, reset] = useDraft(source);
  const save = useAction(() => api.patch(`/homes/${homeId}`, { ...draft, address: draft.address || undefined, description: draft.description || undefined }), { invalidate: [["home", homeId], ["homes"]], success: "Home updated" });
  const editable = can("home.manage");
  return (
    <div className="stack">
      <Card pad title="Home details">
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
          <HomeBasicsFields values={{ ...draft, address: draft.address || "", description: draft.description || "" }} set={(k, v) => setDraft({ ...draft, [k]: v })} />
        </fieldset>
        {draft.currency !== home.currency && <Alert tone="warning" style={{ marginTop: 12 }}>Changing the currency only changes how amounts are labelled — existing amounts are not converted.</Alert>}
      </Card>
      {editable && <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />}
    </div>
  );
}

const RULE_KEYS = ["rules", "departureNoticeDays", "paymentDueDay", "mealPolicy", "guestPolicy", "paymentPolicy", "requireApproval", "codeJoinEnabled", "allowMemberInvites"];

function RulesTab() {
  const { home, homeId, can } = useHome();
  const source = useMemo(() => pick(home.settings, RULE_KEYS), [home]);
  const [d, setD, dirty, reset] = useDraft(source);
  const set = (k, v) => setD({ ...d, [k]: v });
  const save = useAction(() => api.patch(`/homes/${homeId}/settings`, d), { invalidate: [["home", homeId]], success: "Settings saved" });
  if (!can("settings.manage")) {
    return (
      <Card pad title={<h2 className="row"><ScrollText size={15} /> House rules</h2>}>
        {home.settings.rules.length ? <ol className="rules-list">{home.settings.rules.map((r) => <li key={r}>{r}</li>)}</ol> : <p className="muted text-sm">No rules yet.</p>}
        <div className="stack" style={{ marginTop: 16 }}>
          {[["Meal policy", home.settings.mealPolicy], ["Guest policy", home.settings.guestPolicy], ["Payment policy", home.settings.paymentPolicy]].filter(([, t]) => t).map(([l, t]) => <div key={l}><div className="strong text-sm">{l}</div><p className="text-sm muted">{t}</p></div>)}
          <p className="hint">Departure notice: {home.settings.departureNoticeDays} days · Payments due by day {home.settings.paymentDueDay} of each month.</p>
        </div>
      </Card>
    );
  }
  return (
    <div className="stack">
      <Card pad title="House rules"><RulesEditor value={d.rules} onChange={(r) => set("rules", r)} /></Card>
      <Card pad title="Policies">
        <div className="form-grid">
          <Field label="Departure notice (days)" hint="Members must request to leave this many days in advance.">
            <Input type="number" min={0} max={180} value={d.departureNoticeDays} onChange={(e) => set("departureNoticeDays", Math.max(0, Math.min(180, Number(e.target.value) || 0)))} />
          </Field>
          <Field label="Payment due day" hint="Shown on the calendar each month.">
            <Input type="number" min={1} max={28} value={d.paymentDueDay} onChange={(e) => set("paymentDueDay", Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />
          </Field>
          <Field label="Payment policy" optional className="full"><Textarea value={d.paymentPolicy} maxLength={2000} onChange={(e) => set("paymentPolicy", e.target.value)} /></Field>
        </div>
      </Card>
      <Card pad title="Joining">
        <SettingRow title="Approve code joins" description="People joining with the home code wait for an Admin or Manager. Invite links always join directly."><Switch checked={d.requireApproval} onChange={(v) => set("requireApproval", v)} label="Require approval" /></SettingRow>
        <SettingRow title="Allow joining with the home code" description="Turn off to accept invitation links only."><Switch checked={d.codeJoinEnabled} onChange={(v) => set("codeJoinEnabled", v)} label="Code joining" /></SettingRow>
        <SettingRow title="Members can invite" description="Every member can create invitations and see the home code."><Switch checked={d.allowMemberInvites} onChange={(v) => set("allowMemberInvites", v)} label="Members can invite" /></SettingRow>
      </Card>
      <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />
    </div>
  );
}

const MEAL_KEYS = ["mealTypes", "mealOffCutoff", "autoApproveMealOff", "guestMealPricing", "guestMealFixedRate", "mealPolicy", "guestPolicy"];

function MealsTab() {
  const { home, homeId, can, currency } = useHome();
  const source = useMemo(() => ({ ...pick(home.settings, MEAL_KEYS), guestMealFixedRate: toMajorString(home.settings.guestMealFixedRate) || "0" }), [home]);
  const [d, setD, dirty, reset] = useDraft(source);
  const set = (k, v) => setD({ ...d, [k]: v });
  const save = useAction(() => api.patch(`/homes/${homeId}/settings`, { ...d, guestMealFixedRate: d.guestMealFixedRate || "0" }), { invalidate: [["home", homeId], ["meals"]], success: "Meal settings saved" });
  const editable = can("meals.configure");
  return (
    <div className="stack">
      <Alert tone="neutral">Changes apply to open meal periods. Closed periods keep the numbers they were closed with.</Alert>
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <Card pad title="Meal types"><MealTypesEditor value={d.mealTypes} onChange={(m) => set("mealTypes", m)} lockedKeys={home.settings.mealTypes.map((t) => t.key)} /></Card>
        <Card pad title="Requests & guests">
          <div className="form-grid">
            <Field label="Meal-off deadline" hint="Cut-off time on the day before."><Input type="time" value={d.mealOffCutoff} onChange={(e) => set("mealOffCutoff", e.target.value)} /></Field>
            <Field label="Guest meal pricing">
              <Select value={d.guestMealPricing} onChange={(e) => set("guestMealPricing", e.target.value)} options={[{ value: "meal_rate", label: "Charge the meal rate" }, { value: "fixed", label: "Charge a fixed rate" }]} />
            </Field>
            {d.guestMealPricing === "fixed" && <Field label={`Fixed guest rate (${currency} per meal)`}><Input inputMode="decimal" value={d.guestMealFixedRate} onChange={(e) => set("guestMealFixedRate", e.target.value)} /></Field>}
            <Field label="Meal policy" optional className="full"><Textarea value={d.mealPolicy} maxLength={2000} onChange={(e) => set("mealPolicy", e.target.value)} /></Field>
            <Field label="Guest policy" optional className="full"><Textarea value={d.guestPolicy} maxLength={2000} onChange={(e) => set("guestPolicy", e.target.value)} /></Field>
          </div>
          <SettingRow title="Approve meal-off requests automatically" description="Requests submitted before the deadline are applied immediately."><Switch checked={d.autoApproveMealOff} onChange={(v) => set("autoApproveMealOff", v)} label="Auto-approve meal off" disabled={!editable} /></SettingRow>
        </Card>
      </fieldset>
      {editable && <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />}
    </div>
  );
}

const PERM_ROLES = [["manager", "Manager"], ["meal_manager", "Meal manager"], ["member", "Member"]];

function PermissionsTab() {
  const { home, homeId } = useHome();
  const { data } = useQuery({ queryKey: ["perm-catalog"], queryFn: () => api.get("/homes/permissions/catalog") });
  const source = useMemo(
    () => (data ? Object.fromEntries(PERM_ROLES.map(([r]) => [r, home.settings.rolePermissions?.[r] || data.defaults[r]])) : null),
    [data, home]
  );
  const roles = PERM_ROLES;
  const [d, setD, dirty, reset] = useDraft(source);
  const save = useAction(() => api.patch(`/homes/${homeId}/settings`, { rolePermissions: d }), { invalidate: [["home", homeId]], success: "Permissions updated" });
  if (!data || !d) return null;
  const perms = Object.entries(data.permissions).filter(([p]) => !data.adminOnly.includes(p));
  const toggle = (role, p) => setD({ ...d, [role]: d[role].includes(p) ? d[role].filter((x) => x !== p) : [...d[role], p] });
  return (
    <div className="stack">
      <Card title="Role permissions" actions={<Button size="sm" variant="ghost" onClick={() => setD(data.defaults && Object.fromEntries(roles.map(([r]) => [r, data.defaults[r]])))}>Reset to defaults</Button>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Permission</th>{roles.map(([r, l]) => <th key={r} className="c">{l}</th>)}</tr></thead>
            <tbody>
              {perms.map(([p, label]) => (
                <tr key={p}>
                  <td className="text-sm">{label}</td>
                  {roles.map(([r]) => (
                    <td key={r} className="c"><input type="checkbox" style={{ accentColor: "var(--accent)", width: 16, height: 16 }} checked={d[r].includes(p)} onChange={() => toggle(r, p)} aria-label={`${label} for ${r}`} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot hint">The Admin always has every permission. Changing roles, home settings and deleting the home are Admin-only.</div>
      </Card>
      <SaveBar dirty={dirty} loading={save.isPending} onSave={() => save.mutate()} onReset={reset} />
    </div>
  );
}

function DangerTab() {
  const { home, homeId, isAdmin, archived } = useHome();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const after = async () => {
    await qc.invalidateQueries({ queryKey: ["homes"] });
    navigate("/homes");
  };
  const archive = useAction(() => api.post(`/homes/${homeId}/${archived ? "unarchive" : "archive"}`), { invalidate: [["home", homeId], ["homes"]], success: archived ? "Home restored" : "Home archived", onSuccess: () => setModal(null) });
  const del = useAction(() => api.del(`/homes/${homeId}`, { confirmName }), { success: "Home deleted", onSuccess: after });
  const leave = useAction(() => api.post(`/homes/${homeId}/leave`), { success: `You left ${home.name}`, onSuccess: after });
  const notice = home.settings.departureNoticeDays;
  return (
    <div className="stack">
      {!isAdmin && (
        <Card pad title="Leave this home">
          <div className="row between wrap" style={{ gap: 12 }}>
            <p className="text-sm muted grow">{notice > 0 ? `This home requires ${notice} days notice. Submit a departure request and an admin will review it.` : "You'll lose access to this home immediately. Your financial history stays with the home."}</p>
            {notice > 0 ? <Link className="btn btn-secondary" to={`/h/${homeId}/requests?new=departure`}><LogOut size={16} /> Request departure</Link> : <Button variant="danger-ghost" icon={LogOut} onClick={() => setModal("leave")}>Leave home</Button>}
          </div>
        </Card>
      )}
      {isAdmin && (
        <>
          <Alert tone="neutral">As the owner, transfer ownership from the Members page before you can leave.</Alert>
          <Card pad title={archived ? "Restore home" : "Archive home"}>
            <div className="row between wrap" style={{ gap: 12 }}>
              <p className="text-sm muted grow">{archived ? "Make the home editable again." : "Freeze the home: everything stays readable, nothing can be changed. You can restore it any time."}</p>
              <Button icon={archived ? ArchiveRestore : Archive} onClick={() => setModal("archive")}>{archived ? "Restore" : "Archive"}</Button>
            </div>
          </Card>
          <Card pad title="Delete home" style={{ borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))" }}>
            <div className="row between wrap" style={{ gap: 12 }}>
              <p className="text-sm muted grow">Permanently delete this home with all its meals, ledgers, expenses, chat and history. This cannot be undone.</p>
              <Button variant="danger" icon={Trash2} onClick={() => { setConfirmName(""); setModal("delete"); }}>Delete home</Button>
            </div>
          </Card>
        </>
      )}
      <ConfirmDialog open={modal === "archive"} onClose={() => setModal(null)} onConfirm={() => archive.mutate()} loading={archive.isPending} title={archived ? "Restore this home?" : "Archive this home?"} confirmLabel={archived ? "Restore" : "Archive"} />
      <ConfirmDialog open={modal === "leave"} onClose={() => setModal(null)} onConfirm={() => leave.mutate()} loading={leave.isPending} danger title={`Leave ${home.name}?`} confirmLabel="Leave home" description="You'll lose access to the home and its chat." />
      <FormModal open={modal === "delete"} onClose={() => setModal(null)} danger title="Delete this home permanently?" submitLabel="Delete forever" loading={del.isPending} disabled={confirmName.trim() !== home.name} onSubmit={() => del.mutate()}>
        <Alert tone="danger">All members lose access and every record is erased. Consider archiving instead.</Alert>
        <Field label={<>Type <b>{home.name}</b> to confirm</>}><Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" /></Field>
      </FormModal>
    </div>
  );
}

export default function HomeSettings() {
  const { isAdmin, can } = useHome();
  const [params, setParams] = useSearchParams();
  const tabs = [
    { value: "general", label: "General" },
    { value: "rules", label: "Rules & joining" },
    { value: "meals", label: "Meals" },
    ...(isAdmin ? [{ value: "permissions", label: "Permissions" }] : []),
    { value: "danger", label: isAdmin ? "Archive & delete" : "Leave" },
  ];
  const tab = tabs.some((t) => t.value === params.get("tab")) ? params.get("tab") : can("home.manage") ? "general" : "rules";
  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader title="Home settings" />
      <Tabs items={tabs} value={tab} onChange={(t) => setParams({ tab: t })} />
      {tab === "general" && <GeneralTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "meals" && <MealsTab />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "danger" && <DangerTab />}
    </div>
  );
}
