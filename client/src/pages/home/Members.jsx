import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, UserPlus, Pencil, ShieldCheck, Utensils, Crown, UserMinus, Wallet, Check, X, Users, Phone, DoorOpen } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useOnline } from "../../context/RealtimeContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, Money, PageHeader, Switch, Tabs, Textarea, Alert, StatusBadge } from "../../components/ui";
import { ROLE_LABEL, fmtDate, fmtDay, mealTypeLabel, money } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

function RoleBadges({ roles }) {
  return (
    <div className="row wrap" style={{ gap: 4 }}>
      {roles.map((r) => <Badge key={r} tone={r === "admin" ? "accent" : r === "member" ? undefined : "info"} icon={r === "admin" ? Crown : undefined}>{ROLE_LABEL[r]}</Badge>)}
    </div>
  );
}

function MemberName({ m }) {
  const online = useOnline(m.user?._id, m.online);
  const t = useT();
  return (
    <div className="row-3">
      <Avatar user={m.user} size={32} online={online} />
      <div style={{ minWidth: 0 }}>
        <Link to={`/people/${m.user?._id}`} className="strong text-sm truncate" style={{ color: "var(--text)", display: "block" }}>{m.user?.name}</Link>
        <div className="text-xs muted truncate">{m.user?.email || (m.room ? t("account.room", { room: m.room }) : online ? t("members.online") : "")}</div>
      </div>
    </div>
  );
}

export default function Members() {
  const { homeId, home, can, isAdmin, membershipId, currency } = useHome();
  const navigate = useNavigate();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "active";
  const [modal, setModal] = useState(null); // {type, member}
  const [form, setForm] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["members", homeId, tab], queryFn: () => api.get(`/homes/${homeId}/members`, { status: tab }) });
  const { data: pendingData } = useQuery({ queryKey: ["members", homeId, "pending"], queryFn: () => api.get(`/homes/${homeId}/members`, { status: "pending" }), enabled: can("members.manage") });

  const inv = [["members", homeId], ["home", homeId], ["dashboard", homeId], ["homes"]];
  const close = () => setModal(null);
  const save = useAction(({ m, body }) => api.patch(`/homes/${homeId}/members/${m._id}`, body), { invalidate: inv, success: t("members.updated"), onSuccess: close });
  const roles = useAction(({ m, roles }) => api.patch(`/homes/${homeId}/members/${m._id}/roles`, { roles }), { invalidate: inv, success: t("members.roleUpdated"), onSuccess: close });
  const approve = useAction((m) => api.post(`/homes/${homeId}/members/${m._id}/approve`), { invalidate: inv, success: (_, m) => t("members.joined", { name: m.user.name }) });
  const reject = useAction((m) => api.post(`/homes/${homeId}/members/${m._id}/reject`), { invalidate: inv, success: t("requests.declinedToast") });
  const remove = useAction(({ m, reason }) => api.post(`/homes/${homeId}/members/${m._id}/remove`, { reason }), {
    invalidate: inv,
    success: (r, { m }) => (r.balance < 0 ? t("members.removedOwing", { name: m.user.name, amount: money(-r.balance, currency) }) : t("members.removed", { name: m.user.name })),
    onSuccess: close,
  });
  const transfer = useAction((m) => api.post(`/homes/${homeId}/transfer-ownership`, { membershipId: m._id }), { invalidate: inv, success: t("members.transferred"), onSuccess: close });

  const open = (type, m) => {
    setModal({ type, m });
    if (type === "edit") setForm({ room: m.room || "", phone: m.phone || "", emergencyContact: m.emergencyContact || "", note: m.note || "" });
    if (type === "roles") setForm({ roles: m.roles.filter((r) => r !== "admin") });
    if (type === "meals") setForm({ defaults: Object.fromEntries(home.settings.mealTypes.map((mt) => [mt.key, m.defaultMeals?.[mt.key] ?? 1])), mealsEnabled: m.mealsEnabled !== false });
    if (type === "remove") setForm({ reason: "" });
  };

  const members = data?.members || [];
  const showBalance = can("finance.view_all");
  const tabs = [{ value: "active", label: t("members.tabs.active") }];
  if (can("members.manage")) tabs.push({ value: "pending", label: t("members.tabs.pending"), count: pendingData?.members?.length }, { value: "former", label: t("members.tabs.former") });
  const m = modal?.m;

  return (
    <>
      <PageHeader title={t("nav.members")} description={t("members.desc", { home: home.name })} actions={(can("invites.manage") || home.settings.allowMemberInvites) && <Link to={`/h/${homeId}/invites`} className="btn btn-primary"><UserPlus size={16} /> {t("members.invite")}</Link>} />
      {tabs.length > 1 && <Tabs items={tabs} value={tab} onChange={(v) => setParams({ tab: v })} />}
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : members.length === 0 ? (
          <EmptyState icon={Users} title={tab === "pending" ? t("members.noPending") : tab === "former" ? t("members.noFormer") : t("daily.noMembers")} description={tab === "pending" ? t("members.noPendingHint") : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("common.member")}</th>
                  <th>{t("members.role")}</th>
                  <th className="hide-sm">{t("members.roomCol")}</th>
                  {tab === "active" && <th className="hide-sm">{t("settings.profile.phone")}</th>}
                  {tab === "active" && showBalance && <th className="r">{t("common.balance")}</th>}
                  <th className="hide-sm">{tab === "former" ? t("members.left") : tab === "pending" ? t("members.requested") : t("members.joinedCol")}</th>
                  <th style={{ width: 1 }} />
                </tr>
              </thead>
              <tbody>
                {members.map((x) => {
                  const self = x._id === membershipId;
                  const isOwner = x.roles.includes("admin");
                  return (
                    <tr key={x._id}>
                      <td><MemberName m={x} /></td>
                      <td>
                        <RoleBadges roles={x.roles} />
                        {x.scheduledLeaveDay && <div className="text-xs" style={{ color: "var(--warning)", marginTop: 4 }}><DoorOpen size={11} /> {t("members.leaving", { day: fmtDay(x.scheduledLeaveDay) })}</div>}
                      </td>
                      <td className="hide-sm text-sm">{x.room || <span className="subtle">—</span>}</td>
                      {tab === "active" && <td className="hide-sm text-sm">{x.phone ? <a href={`tel:${x.phone}`} className="row" style={{ gap: 4 }}><Phone size={12} />{x.phone}</a> : <span className="subtle">—</span>}</td>}
                      {tab === "active" && showBalance && <td className="r"><Money value={x.balance} currency={currency} colored /></td>}
                      <td className="hide-sm text-xs muted">{fmtDate(tab === "former" ? x.leftAt : tab === "pending" ? x.updatedAt : x.joinedAt)}</td>
                      <td>
                        {tab === "pending" ? (
                          <div className="row">
                            <Button size="sm" variant="ghost" icon={X} onClick={() => reject.mutate(x)} aria-label={t("requests.decline")} />
                            <Button size="sm" variant="primary" icon={Check} onClick={() => approve.mutate(x)} loading={approve.isPending && approve.variables?._id === x._id}>{t("requests.approve")}</Button>
                          </div>
                        ) : tab === "active" ? (
                          <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={t("recurring.actionsFor", { title: x.user?.name })} />}>
                            {(showBalance || self) && <MenuItem icon={Wallet} onClick={() => navigate(self ? `/h/${homeId}/finance/me` : `/h/${homeId}/finance/accounts/${x._id}`)}>{t("members.viewAccount")}</MenuItem>}
                            {(self || can("members.manage")) && <MenuItem icon={Pencil} onClick={() => open("edit", x)}>{t("members.editDetails")}</MenuItem>}
                            {can("meals.manage") && <MenuItem icon={Utensils} onClick={() => open("meals", x)}>{t("members.mealDefaults")}</MenuItem>}
                            {isAdmin && !isOwner && <MenuItem icon={ShieldCheck} onClick={() => open("roles", x)}>{t("members.changeRole")}</MenuItem>}
                            {isAdmin && !isOwner && <MenuItem icon={Crown} onClick={() => open("transfer", x)}>{t("members.makeOwner")}</MenuItem>}
                            {can("members.manage") && !isOwner && !self && (
                              <>
                                <div className="menu-sep" />
                                <MenuItem icon={UserMinus} danger onClick={() => open("remove", x)}>{t("members.removeFromHome")}</MenuItem>
                              </>
                            )}
                          </Menu>
                        ) : (
                          <StatusBadge status={x.status} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FormModal open={modal?.type === "edit"} onClose={close} title={t("members.editTitle", { name: m?.user?.name })} loading={save.isPending}
        onSubmit={() => save.mutate({ m, body: can("members.manage") ? form : { room: form.room, phone: form.phone, emergencyContact: form.emergencyContact } })}>
        <div className="form-grid">
          <Field label={t("members.roomBed")}><Input value={form.room || ""} maxLength={40} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
          <Field label={t("settings.profile.phone")}><Input type="tel" value={form.phone || ""} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t("members.emergency")} className="full"><Input value={form.emergencyContact || ""} maxLength={120} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></Field>
          {can("members.manage") && <Field label={t("members.privateNote")} hint={t("members.privateNoteHint")} className="full"><Textarea value={form.note || ""} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>}
        </div>
      </FormModal>

      <FormModal open={modal?.type === "roles"} onClose={close} title={t("members.changeRole")} description={t("members.roleQuestion", { name: m?.user?.name })} loading={roles.isPending}
        disabled={!form.roles?.length} onSubmit={() => roles.mutate({ m, roles: form.roles })}>
        {[
          ["manager", ROLE_LABEL.manager, t("members.roleDesc.manager")],
          ["meal_manager", ROLE_LABEL.meal_manager, t("members.roleDesc.meal_manager")],
          ["member", ROLE_LABEL.member, t("members.roleDesc.member")],
        ].map(([value, label, desc]) => (
          <label key={value} className="checkbox card card-pad" style={{ padding: 12 }}>
            <input type="checkbox" checked={form.roles?.includes(value) || false} onChange={(e) => setForm({ roles: e.target.checked ? [...form.roles, value] : form.roles.filter((r) => r !== value) })} />
            <span><span className="strong">{label}</span><br /><span className="hint">{desc}</span></span>
          </label>
        ))}
      </FormModal>

      <FormModal open={modal?.type === "meals"} onClose={close} title={t("members.mealDefaults")} description={t("members.mealDefaultsDesc", { name: m?.user?.name })} loading={save.isPending}
        onSubmit={() => save.mutate({ m, body: { defaultMeals: Object.fromEntries(Object.entries(form.defaults).map(([k, v]) => [k, Number(v) || 0])), mealsEnabled: form.mealsEnabled } })}>
        <div className="setting-row" style={{ paddingTop: 0 }}>
          <div><div className="strong text-sm">{t("members.takesMeals")}</div><div className="hint">{t("members.takesMealsHint")}</div></div>
          <Switch checked={form.mealsEnabled} onChange={(v) => setForm({ ...form, mealsEnabled: v })} label={t("members.takesMeals")} />
        </div>
        <div className="grid-3">
          {home.settings.mealTypes.filter((mt) => mt.enabled).map((mt) => (
            <Field key={mt.key} label={mealTypeLabel(mt)}>
              <Input type="number" min={0} max={10} step={1} value={form.defaults?.[mt.key] ?? 1} disabled={!form.mealsEnabled} onChange={(e) => setForm({ ...form, defaults: { ...form.defaults, [mt.key]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </FormModal>

      <FormModal open={modal?.type === "remove"} onClose={close} danger title={t("members.removeTitle", { name: m?.user?.name })} submitLabel={t("members.removeSubmit")} loading={remove.isPending} onSubmit={() => remove.mutate({ m, reason: form.reason })}>
        <Alert tone="warning">{t("members.removeWarning")}{showBalance && m && <> {t("members.currentBalance")} <b><Money value={m.balance} currency={currency} /></b>.</>}</Alert>
        <Field label={t("common.reason")} optional><Input value={form.reason || ""} maxLength={300} onChange={(e) => setForm({ reason: e.target.value })} /></Field>
      </FormModal>

      <ConfirmDialog open={modal?.type === "transfer"} onClose={close} title={t("members.ownerTitle", { name: m?.user?.name })} confirmLabel={t("members.transferSubmit")} danger loading={transfer.isPending} onConfirm={() => transfer.mutate(m)}
        description={t("members.ownerDesc")} />
    </>
  );
}
