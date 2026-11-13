import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link2, RefreshCw, Send, Trash2, Mail, KeyRound, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useToast } from "../../context/ToastContext";
import { useAction, useDebounced } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, FormModal, Input, LoadingBlock, Modal, PageHeader, Select, StatusBadge } from "../../components/ui";
import { fmtDate, timeAgo } from "../../lib/format";

const invStatus = (i) => {
  if (i.status !== "active") return i.status;
  if (i.expiresAt && new Date(i.expiresAt) < new Date()) return "expired";
  if (i.maxUses && i.uses >= i.maxUses) return "used";
  return "active";
};

export default function Invites() {
  const { homeId, home, can } = useHome();
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

  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast.success("Copied to clipboard"));
  const inv = [["invitations", homeId]];
  const createLink = useAction(() => api.post(`/homes/${homeId}/invitations`, { kind: "link", label: linkForm.label || undefined, expiresInDays: linkForm.expiresInDays === "never" ? null : Number(linkForm.expiresInDays), maxUses: linkForm.maxUses ? Number(linkForm.maxUses) : null }), {
    invalidate: inv,
    onSuccess: (r) => { setLinkModal(false); setCreated(r); },
  });
  const direct = useAction((body) => api.post(`/homes/${homeId}/invitations`, { kind: "direct", ...body }), {
    invalidate: inv,
    success: (r) => (r.emailed ? "Invitation emailed" : "Invitation sent"),
    onSuccess: () => { setEmail(""); setQ(""); },
  });
  const revoke = useAction((i) => api.del(`/homes/${homeId}/invitations/${i._id}`), { invalidate: inv, success: "Invitation revoked" });
  const regen = useAction(() => api.post(`/homes/${homeId}/code/regenerate`), { invalidate: [...inv, ["home", homeId]], success: "New code generated. The old code no longer works.", onSuccess: () => setConfirmRegen(false) });

  return (
    <>
      <PageHeader title="Invitations" description="Bring roommates into this home." actions={<Button variant="primary" icon={Link2} onClick={() => setLinkModal(true)}>New invite link</Button>} />
      <div className="bento">
        <Card className="span-6" title={<h2 className="row"><KeyRound size={15} /> Home code</h2>} actions={can("invites.manage") && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setConfirmRegen(true)}>Regenerate</Button>}>
          <div className="card-body stack">
            <div className="code-box"><span className="big">{data?.code || home.code || "········"}</span><Button size="sm" icon={Copy} onClick={() => copy(data?.code || home.code)}>Copy</Button></div>
            <p className="hint">{data?.codeJoinEnabled === false ? "Joining by code is turned off in settings." : home.settings.requireApproval ? "People who join with the code wait for approval." : "People who join with the code become members immediately."}</p>
          </div>
        </Card>
        <Card className="span-6" title={<h2 className="row"><Mail size={15} /> Invite a person</h2>}>
          <div className="card-body stack">
            <form className="row" onSubmit={(e) => { e.preventDefault(); direct.mutate({ email: email.trim() }); }}>
              <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" icon={Send} disabled={!email.includes("@")} loading={direct.isPending && !!email}>Send</Button>
            </form>
            <div className="input-group"><Search /><Input placeholder="…or search BachelorMate users by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {search?.users?.length > 0 && q.length >= 2 && (
              <div className="card">
                {search.users.slice(0, 5).map((u) => (
                  <div className="list-item" key={u._id}>
                    <Avatar user={u} size={28} />
                    <span className="grow text-sm">{u.name}</span>
                    <Button size="sm" onClick={() => direct.mutate({ userId: u._id })}>Invite</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card className="span-12" title="Sent invitations">
          {isLoading ? <LoadingBlock rows={3} /> : !data?.invitations?.length ? (
            <EmptyState icon={Link2} title="No invitations yet" description="Create a link or invite someone directly." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Invitation</th><th>Status</th><th className="hide-sm">Uses</th><th className="hide-sm">Expires</th><th className="hide-sm">Created</th><th /></tr></thead>
                <tbody>
                  {data.invitations.map((i) => {
                    const st = invStatus(i);
                    return (
                      <tr key={i._id}>
                        <td>
                          {i.kind === "direct" ? (
                            <div className="row"><Avatar user={i.invitee} size={24} /><span className="text-sm">{i.invitee?.name}</span></div>
                          ) : (
                            <div className="row"><Link2 size={14} className="subtle" /><span className="text-sm">{i.label || "Invite link"}</span><span className="mono subtle">{i.tokenHint}…</span></div>
                          )}
                        </td>
                        <td><StatusBadge status={st === "used" ? "accepted" : st} label={st} /></td>
                        <td className="hide-sm text-sm num">{i.uses}{i.maxUses ? ` / ${i.maxUses}` : ""}</td>
                        <td className="hide-sm text-xs muted">{i.expiresAt ? fmtDate(i.expiresAt) : "Never"}</td>
                        <td className="hide-sm text-xs muted">{i.createdBy?.name} · {timeAgo(i.createdAt)}</td>
                        <td>{st === "active" && <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => revoke.mutate(i)}>Revoke</Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <FormModal open={linkModal} onClose={() => setLinkModal(false)} title="New invitation link" submitLabel="Create link" loading={createLink.isPending} onSubmit={() => createLink.mutate()}>
        <Field label="Label" optional hint="Only you see this, e.g. “WhatsApp group”."><Input value={linkForm.label} maxLength={60} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Expires after">
            <Select value={linkForm.expiresInDays} onChange={(e) => setLinkForm({ ...linkForm, expiresInDays: e.target.value })} options={[["1", "1 day"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["never", "Never"]].map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Max uses" optional><Input type="number" min={1} max={100} value={linkForm.maxUses} placeholder="Unlimited" onChange={(e) => setLinkForm({ ...linkForm, maxUses: e.target.value })} /></Field>
        </div>
      </FormModal>

      <Modal open={Boolean(created)} onClose={() => setCreated(null)} title="Your invitation link" description="Copy it now — for security, the full link is only shown once." footer={<Button variant="primary" onClick={() => setCreated(null)}>Done</Button>}>
        {created && <div className="code-box"><span className="truncate">{created.url}</span><Button size="sm" icon={Copy} onClick={() => copy(created.url)}>Copy</Button></div>}
        {created && <p className="hint" style={{ marginTop: 10 }}><Badge>{created.invitation.maxUses ? `${created.invitation.maxUses} use(s)` : "Unlimited uses"}</Badge> {created.invitation.expiresAt ? `Expires ${fmtDate(created.invitation.expiresAt)}` : "Never expires"}</p>}
      </Modal>

      <ConfirmDialog open={confirmRegen} onClose={() => setConfirmRegen(false)} onConfirm={() => regen.mutate()} loading={regen.isPending} title="Generate a new home code?" description="The current code will stop working immediately. Existing members are not affected." confirmLabel="Regenerate" />
    </>
  );
}
