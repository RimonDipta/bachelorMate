import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, UserPlus, Pencil, ShieldCheck, Utensils, Crown, UserMinus, Wallet, Check, X, Users, Phone, DoorOpen } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useOnline } from "../../context/RealtimeContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, Money, PageHeader, Switch, Tabs, Textarea, Alert } from "../../components/ui";
import { ROLE_LABEL, fmtDate, fmtDay, money } from "../../lib/format";

function RoleBadges({ roles }) {
  return (
    <div className="row wrap" style={{ gap: 4 }}>
      {roles.map((r) => <Badge key={r} tone={r === "admin" ? "accent" : r === "member" ? undefined : "info"} icon={r === "admin" ? Crown : undefined}>{ROLE_LABEL[r]}</Badge>)}
    </div>
  );
}

function MemberName({ m }) {
  const online = useOnline(m.user?._id, m.online);
  return (
    <div className="row-3">
      <Avatar user={m.user} size={32} online={online} />
      <div style={{ minWidth: 0 }}>
        <Link to={`/people/${m.user?._id}`} className="strong text-sm truncate" style={{ color: "var(--text)", display: "block" }}>{m.user?.name}</Link>
        <div className="text-xs muted truncate">{m.user?.email || (m.room ? `Room ${m.room}` : online ? "Online" : "")}</div>
      </div>
    </div>
  );
}

export default function Members() {
  const { homeId, home, can, isAdmin, membershipId, currency } = useHome();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "active";
  const [modal, setModal] = useState(null); // {type, member}
  const [form, setForm] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["members", homeId, tab], queryFn: () => api.get(`/homes/${homeId}/members`, { status: tab }) });
  const { data: pendingData } = useQuery({ queryKey: ["members", homeId, "pending"], queryFn: () => api.get(`/homes/${homeId}/members`, { status: "pending" }), enabled: can("members.manage") });

  const inv = [["members", homeId], ["home", homeId], ["dashboard", homeId], ["homes"]];
  const close = () => setModal(null);
  const save = useAction(({ m, body }) => api.patch(`/homes/${homeId}/members/${m._id}`, body), { invalidate: inv, success: "Member updated", onSuccess: close });
  const roles = useAction(({ m, roles }) => api.patch(`/homes/${homeId}/members/${m._id}/roles`, { roles }), { invalidate: inv, success: "Role updated", onSuccess: close });
  const approve = useAction((m) => api.post(`/homes/${homeId}/members/${m._id}/approve`), { invalidate: inv, success: (_, m) => `${m.user.name} joined the home` });
  const reject = useAction((m) => api.post(`/homes/${homeId}/members/${m._id}/reject`), { invalidate: inv, success: "Request declined" });
  const remove = useAction(({ m, reason }) => api.post(`/homes/${homeId}/members/${m._id}/remove`, { reason }), {
    invalidate: inv,
    success: (r, { m }) => `${m.user.name} was removed${r.balance < 0 ? ` with ${money(-r.balance, currency)} outstanding` : ""}`,
    onSuccess: close,
  });
  const transfer = useAction((m) => api.post(`/homes/${homeId}/transfer-ownership`, { membershipId: m._id }), { invalidate: inv, success: "Ownership transferred", onSuccess: close });

  const open = (type, m) => {
    setModal({ type, m });
    if (type === "edit") setForm({ room: m.room || "", phone: m.phone || "", emergencyContact: m.emergencyContact || "", note: m.note || "" });
    if (type === "roles") setForm({ roles: m.roles.filter((r) => r !== "admin") });
    if (type === "meals") setForm({ defaults: Object.fromEntries(home.settings.mealTypes.map((t) => [t.key, m.defaultMeals?.[t.key] ?? 1])), mealsEnabled: m.mealsEnabled !== false });
    if (type === "remove") setForm({ reason: "" });
  };

  const members = data?.members || [];
  const showBalance = can("finance.view_all");
  const tabs = [{ value: "active", label: "Active" }];
  if (can("members.manage")) tabs.push({ value: "pending", label: "Pending", count: pendingData?.members?.length }, { value: "former", label: "Former" });
  const m = modal?.m;

  return (
    <>
      <PageHeader title="Members" description={`People living in ${home.name}.`} actions={(can("invites.manage") || home.settings.allowMemberInvites) && <Link to={`/h/${homeId}/invites`} className="btn btn-primary"><UserPlus size={16} /> Invite</Link>} />
      {tabs.length > 1 && <Tabs items={tabs} value={tab} onChange={(t) => setParams({ tab: t })} />}
      <Card>
        {isLoading ? <LoadingBlock /> : error ? <ErrorState error={error} retry={refetch} /> : members.length === 0 ? (
          <EmptyState icon={Users} title={tab === "pending" ? "No pending requests" : tab === "former" ? "No former members" : "No members"} description={tab === "pending" ? "People who request to join will appear here." : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th className="hide-sm">Room</th>
                  {tab === "active" && <th className="hide-sm">Phone</th>}
                  {tab === "active" && showBalance && <th className="r">Balance</th>}
                  <th className="hide-sm">{tab === "former" ? "Left" : tab === "pending" ? "Requested" : "Joined"}</th>
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
                        {x.scheduledLeaveDay && <div className="text-xs" style={{ color: "var(--warning)", marginTop: 4 }}><DoorOpen size={11} /> Leaving {fmtDay(x.scheduledLeaveDay)}</div>}
                      </td>
                      <td className="hide-sm text-sm">{x.room || <span className="subtle">—</span>}</td>
                      {tab === "active" && <td className="hide-sm text-sm">{x.phone ? <a href={`tel:${x.phone}`} className="row" style={{ gap: 4 }}><Phone size={12} />{x.phone}</a> : <span className="subtle">—</span>}</td>}
                      {tab === "active" && showBalance && <td className="r"><Money value={x.balance} currency={currency} colored /></td>}
                      <td className="hide-sm text-xs muted">{fmtDate(tab === "former" ? x.leftAt : tab === "pending" ? x.updatedAt : x.joinedAt)}</td>
                      <td>
                        {tab === "pending" ? (
                          <div className="row">
                            <Button size="sm" variant="ghost" icon={X} onClick={() => reject.mutate(x)} aria-label="Decline" />
                            <Button size="sm" variant="primary" icon={Check} onClick={() => approve.mutate(x)} loading={approve.isPending && approve.variables?._id === x._id}>Approve</Button>
                          </div>
                        ) : tab === "active" ? (
                          <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={`Actions for ${x.user?.name}`} />}>
                            {(showBalance || self) && <MenuItem icon={Wallet} onClick={() => navigate(self ? `/h/${homeId}/finance/me` : `/h/${homeId}/finance/accounts/${x._id}`)}>View account</MenuItem>}
                            {(self || can("members.manage")) && <MenuItem icon={Pencil} onClick={() => open("edit", x)}>Edit details</MenuItem>}
                            {can("meals.manage") && <MenuItem icon={Utensils} onClick={() => open("meals", x)}>Meal defaults</MenuItem>}
                            {isAdmin && !isOwner && <MenuItem icon={ShieldCheck} onClick={() => open("roles", x)}>Change role</MenuItem>}
                            {isAdmin && !isOwner && <MenuItem icon={Crown} onClick={() => open("transfer", x)}>Make owner</MenuItem>}
                            {can("members.manage") && !isOwner && !self && (
                              <>
                                <div className="menu-sep" />
                                <MenuItem icon={UserMinus} danger onClick={() => open("remove", x)}>Remove from home</MenuItem>
                              </>
                            )}
                          </Menu>
                        ) : (
                          <Badge>{x.status}</Badge>
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

      <FormModal open={modal?.type === "edit"} onClose={close} title={`Edit ${m?.user?.name}`} loading={save.isPending}
        onSubmit={() => save.mutate({ m, body: can("members.manage") ? form : { room: form.room, phone: form.phone, emergencyContact: form.emergencyContact } })}>
        <div className="form-grid">
          <Field label="Room / bed"><Input value={form.room || ""} maxLength={40} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
          <Field label="Phone"><Input type="tel" value={form.phone || ""} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Emergency contact" className="full"><Input value={form.emergencyContact || ""} maxLength={120} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></Field>
          {can("members.manage") && <Field label="Private note" hint="Visible to managers only." className="full"><Textarea value={form.note || ""} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>}
        </div>
      </FormModal>

      <FormModal open={modal?.type === "roles"} onClose={close} title="Change role" description={`What can ${m?.user?.name} manage?`} loading={roles.isPending}
        disabled={!form.roles?.length} onSubmit={() => roles.mutate({ m, roles: form.roles })}>
        {[
          ["manager", "Manager", "Members, invitations, payments, expenses, announcements and reports."],
          ["meal_manager", "Meal manager", "Daily meals, meal periods, guest & meal-off requests, grocery expenses."],
          ["member", "Member", "Personal account, meals, requests and chat."],
        ].map(([value, label, desc]) => (
          <label key={value} className="checkbox card card-pad" style={{ padding: 12 }}>
            <input type="checkbox" checked={form.roles?.includes(value) || false} onChange={(e) => setForm({ roles: e.target.checked ? [...form.roles, value] : form.roles.filter((r) => r !== value) })} />
            <span><span className="strong">{label}</span><br /><span className="hint">{desc}</span></span>
          </label>
        ))}
      </FormModal>

      <FormModal open={modal?.type === "meals"} onClose={close} title="Meal defaults" description={`Used when filling ${m?.user?.name}'s daily meals automatically.`} loading={save.isPending}
        onSubmit={() => save.mutate({ m, body: { defaultMeals: Object.fromEntries(Object.entries(form.defaults).map(([k, v]) => [k, Number(v) || 0])), mealsEnabled: form.mealsEnabled } })}>
        <div className="setting-row" style={{ paddingTop: 0 }}>
          <div><div className="strong text-sm">Takes meals in this home</div><div className="hint">Turn off for members who never eat here.</div></div>
          <Switch checked={form.mealsEnabled} onChange={(v) => setForm({ ...form, mealsEnabled: v })} label="Takes meals" />
        </div>
        <div className="grid-3">
          {home.settings.mealTypes.filter((t) => t.enabled).map((t) => (
            <Field key={t.key} label={t.label}>
              <Input type="number" min={0} max={10} step={1} value={form.defaults?.[t.key] ?? 1} disabled={!form.mealsEnabled} onChange={(e) => setForm({ ...form, defaults: { ...form.defaults, [t.key]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </FormModal>

      <FormModal open={modal?.type === "remove"} onClose={close} danger title={`Remove ${m?.user?.name}?`} submitLabel="Remove member" loading={remove.isPending} onSubmit={() => remove.mutate({ m, reason: form.reason })}>
        <Alert tone="warning">They lose access to the home and its chat immediately. Their financial history is kept.{showBalance && m && <> Current balance: <b><Money value={m.balance} currency={currency} /></b>.</>}</Alert>
        <Field label="Reason" optional><Input value={form.reason || ""} maxLength={300} onChange={(e) => setForm({ reason: e.target.value })} /></Field>
      </FormModal>

      <ConfirmDialog open={modal?.type === "transfer"} onClose={close} title={`Make ${m?.user?.name} the owner?`} confirmLabel="Transfer ownership" danger loading={transfer.isPending} onConfirm={() => transfer.mutate(m)}
        description="They become the Admin with full control. You'll become a Manager. This can only be undone by the new owner." />
    </>
  );
}
