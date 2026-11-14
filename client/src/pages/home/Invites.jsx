import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link2, RefreshCw, Send, Trash2, Mail, KeyRound, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { useAction, useDebounced } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, FormModal, Input, LoadingBlock, Modal, PageHeader, Select, StatusBadge } from "../../components/ui";
import { fmtDate, num, timeAgo } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

const invStatus = (i) => {
  if (i.status !== "active") return i.status;
  if (i.expiresAt && new Date(i.expiresAt) < new Date()) return "expired";
  if (i.maxUses && i.uses >= i.maxUses) return "used";
  return "active";
};

export default function Invites() {
  const { homeId, home, can } = useHome();
  const t = useT();
  const toast = useToast();
  const [linkModal, setLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ label: "", expiresInDays: "7", maxUses: "" });
  const [created, setCreated] = useState(null);
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const debounced = useDebounced(q);
  const { data, isLoading } = useQuery({ queryKey: ["invitations", homeId], queryFn: () => api.get(`/homes/${homeId}/invitations`) });
  const { data: search } = useQuery({ queryKey: ["user-search", debounced], queryFn: () => api.get("/users/search", { q: debounced }), enabled: debounced.trim().length >= 2 });

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success(t("invites.copied")));
  const inv = [["invitations", homeId]];
  const createLink = useAction(() => api.post(`/homes/${homeId}/invitations`, { kind: "link", label: linkForm.label || undefined, expiresInDays: linkForm.expiresInDays === "never" ? null : Number(linkForm.expiresInDays), maxUses: linkForm.maxUses ? Number(linkForm.maxUses) : null }), {
    invalidate: inv,
    onSuccess: (r) => { setLinkModal(false); setCreated(r); },
  });
  const direct = useAction((body) => api.post(`/homes/${homeId}/invitations`, { kind: "direct", ...body }), {
    invalidate: inv,
    success: (r) => (r.emailed ? t("invites.emailed") : t("invites.sent")),
    onSuccess: () => { setEmail(""); setQ(""); },
  });
  const revoke = useAction((i) => api.del(`/homes/${homeId}/invitations/${i._id}`), { invalidate: inv, success: t("invites.revoked") });
  const regen = useAction(() => api.post(`/homes/${homeId}/code/regenerate`), { invalidate: [...inv, ["home", homeId]], success: t("invites.newCode"), onSuccess: () => setConfirmRegen(false) });

  return (
    <>
      <PageHeader title={t("nav.invitations")} description={t("invites.desc")} actions={<Button variant="primary" icon={Link2} onClick={() => setLinkModal(true)}>{t("invites.newLink")}</Button>} />
      <div className="bento">
        <Card className="span-6" title={<h2 className="row"><KeyRound size={15} /> {t("invites.homeCode")}</h2>} actions={can("invites.manage") && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setConfirmRegen(true)}>{t("invites.regenerate")}</Button>}>
          <div className="card-body stack">
            <div className="code-box"><span className="big">{data?.code || home.code || "········"}</span><Button size="sm" icon={Copy} onClick={() => copy(data?.code || home.code)}>{t("invites.copy")}</Button></div>
            <p className="hint">{data?.codeJoinEnabled === false ? t("invites.codeOff") : home.settings.requireApproval ? t("invites.codeApproval") : t("invites.codeDirect")}</p>
          </div>
        </Card>
        <Card className="span-6" title={<h2 className="row"><Mail size={15} /> {t("invites.invitePerson")}</h2>}>
          <div className="card-body stack">
            <form className="row" onSubmit={(e) => { e.preventDefault(); direct.mutate({ email: email.trim() }); }}>
              <Input type="email" placeholder={t("invites.emailPlaceholder")} aria-label={t("invites.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" icon={Send} disabled={!email.includes("@")} loading={direct.isPending && !!email}>{t("invites.send")}</Button>
            </form>
            <div className="input-group"><Search /><Input placeholder={t("invites.searchPlaceholder")} aria-label={t("invites.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {search?.users?.length > 0 && q.length >= 2 && (
              <div className="card">
                {search.users.slice(0, 5).map((u) => (
                  <div className="list-item" key={u._id}>
                    <Avatar user={u} size={28} />
                    <span className="grow text-sm">{u.name}</span>
                    <Button size="sm" onClick={() => direct.mutate({ userId: u._id })}>{t("members.invite")}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card className="span-12" title={t("invites.sentTitle")}>
          {isLoading ? <LoadingBlock rows={3} /> : !data?.invitations?.length ? (
            <EmptyState icon={Link2} title={t("invites.none")} description={t("invites.noneHint")} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t("invites.invitation")}</th><th>{t("common.status")}</th><th className="hide-sm">{t("invites.uses")}</th><th className="hide-sm">{t("invites.expires")}</th><th className="hide-sm">{t("invites.created")}</th><th /></tr></thead>
                <tbody>
                  {data.invitations.map((i) => {
                    const st = invStatus(i);
                    return (
                      <tr key={i._id}>
                        <td>
                          {i.kind === "direct" ? (
                            <div className="row"><Avatar user={i.invitee} size={24} /><span className="text-sm">{i.invitee?.name}</span></div>
                          ) : (
                            <div className="row"><Link2 size={14} className="subtle" /><span className="text-sm">{i.label || t("invites.inviteLink")}</span><span className="mono subtle">{i.tokenHint}…</span></div>
                          )}
                        </td>
                        <td><StatusBadge status={st === "used" ? "accepted" : st} label={st === "used" ? t("invites.used") : undefined} /></td>
                        <td className="hide-sm text-sm num">{num(i.uses)}{i.maxUses ? ` / ${num(i.maxUses)}` : ""}</td>
                        <td className="hide-sm text-xs muted">{i.expiresAt ? fmtDate(i.expiresAt) : t("invites.never")}</td>
                        <td className="hide-sm text-xs muted">{i.createdBy?.name} · {timeAgo(i.createdAt)}</td>
                        <td>{st === "active" && <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => revoke.mutate(i)}>{t("invites.revoke")}</Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <FormModal open={linkModal} onClose={() => setLinkModal(false)} title={t("invites.newLinkTitle")} submitLabel={t("invites.createLink")} loading={createLink.isPending} onSubmit={() => createLink.mutate()}>
        <Field label={t("invites.label")} optional hint={t("invites.labelHint")}><Input value={linkForm.label} maxLength={60} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label={t("invites.expiresAfter")}>
            <Select value={linkForm.expiresInDays} onChange={(e) => setLinkForm({ ...linkForm, expiresInDays: e.target.value })} options={["1", "7", "30", "90", "never"].map((value) => ({ value, label: value === "never" ? t("invites.never") : t("invites.days", { count: Number(value) }) }))} />
          </Field>
          <Field label={t("invites.maxUses")} optional><Input type="number" min={1} max={100} value={linkForm.maxUses} placeholder={t("invites.unlimited")} onChange={(e) => setLinkForm({ ...linkForm, maxUses: e.target.value })} /></Field>
        </div>
      </FormModal>

      <Modal open={Boolean(created)} onClose={() => setCreated(null)} title={t("invites.yourLink")} description={t("invites.yourLinkHint")} footer={<Button variant="primary" onClick={() => setCreated(null)}>{t("setup.done")}</Button>}>
        {created && <div className="code-box"><span className="truncate">{created.url}</span><Button size="sm" icon={Copy} onClick={() => copy(created.url)}>{t("invites.copy")}</Button></div>}
        {created && <p className="hint" style={{ marginTop: 10 }}><Badge>{created.invitation.maxUses ? t("invites.usesCount", { count: created.invitation.maxUses }) : t("invites.unlimitedUses")}</Badge> {created.invitation.expiresAt ? t("invites.expiresOn", { day: fmtDate(created.invitation.expiresAt) }) : t("invites.neverExpires")}</p>}
      </Modal>

      <ConfirmDialog open={confirmRegen} onClose={() => setConfirmRegen(false)} onConfirm={() => regen.mutate()} loading={regen.isPending} title={t("invites.regenTitle")} description={t("invites.regenHint")} confirmLabel={t("invites.regenerate")} />
    </>
  );
}
