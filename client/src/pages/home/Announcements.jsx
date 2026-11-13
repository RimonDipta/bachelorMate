import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone, Pin, MoreHorizontal, Pencil, Trash2, Check, CalendarDays } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAuth } from "../../context/AuthContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, PageHeader, SettingRow, Switch, Textarea } from "../../components/ui";
import { fmtDay, timeAgo } from "../../lib/format";

export default function Announcements() {
  const { homeId, can } = useHome();
  const { user } = useAuth();
  const [editing, setEditing] = useState(null); // {} for new
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["announcements", homeId], queryFn: () => api.get(`/homes/${homeId}/announcements`) });
  const inv = [["announcements", homeId], ["dashboard", homeId], ["calendar"]];
  const save = useAction(() => {
    const body = { title: editing.title, body: editing.body, important: editing.important, pinned: editing.pinned, eventDay: editing.eventDay || "" };
    return editing._id ? api.patch(`/homes/${homeId}/announcements/${editing._id}`, body) : api.post(`/homes/${homeId}/announcements`, body);
  }, { invalidate: inv, success: () => (editing?._id ? "Announcement updated" : "Announcement published"), onSuccess: () => setEditing(null) });
  const del = useAction((a) => api.del(`/homes/${homeId}/announcements/${a._id}`), { invalidate: inv, success: "Announcement deleted", onSuccess: () => setDeleting(null) });
  const ack = useAction((a) => api.post(`/homes/${homeId}/announcements/${a._id}/acknowledge`), { invalidate: inv, success: "Acknowledged" });
  const manage = can("announcements.manage");

  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader title="Announcements" description="Important news for everyone in the home." actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEditing({ title: "", body: "", important: false, pinned: false, eventDay: "" })}>New announcement</Button>} />
      {isLoading ? <Card><LoadingBlock /></Card> : !data.announcements.length ? (
        <Card><EmptyState icon={Megaphone} title="No announcements" description={manage ? "Share rules updates, maintenance notices or events." : "Your managers haven't posted anything yet."} /></Card>
      ) : (
        <div className="stack">
          {data.announcements.map((a) => {
            const acked = a.acknowledgements.some((x) => (x.user?._id || x.user) === user._id);
            return (
              <Card key={a._id} as="article" style={a.important ? { borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))" } : undefined}>
                <div className="card-body stack" style={{ gap: 10 }}>
                  <div className="row between" style={{ alignItems: "flex-start" }}>
                    <div className="row-3">
                      <Avatar user={a.author} size={32} />
                      <div>
                        <div className="text-sm strong">{a.author?.name}</div>
                        <div className="text-xs muted">{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                    <div className="row">
                      {a.pinned && <Badge icon={Pin}>Pinned</Badge>}
                      {a.important && <Badge tone="danger">Important</Badge>}
                      {manage && (
                        <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label="Announcement actions" />}>
                          <MenuItem icon={Pencil} onClick={() => setEditing({ ...a, eventDay: a.eventDay || "" })}>Edit</MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => setDeleting(a)}>Delete</MenuItem>
                        </Menu>
                      )}
                    </div>
                  </div>
                  <h2>{a.title}</h2>
                  <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-2)" }}>{a.body}</p>
                  {a.eventDay && <div className="row text-sm muted"><CalendarDays size={14} /> {fmtDay(a.eventDay, { weekday: "long", month: "long", day: "numeric" })}</div>}
                </div>
                <div className="card-foot row between">
                  <span className="text-xs muted">{a.acknowledgements.length} acknowledged{manage && a.acknowledgements.length > 0 ? `: ${a.acknowledgements.map((x) => x.user?.name).filter(Boolean).join(", ")}` : ""}</span>
                  {acked ? <Badge tone="success" icon={Check}>You acknowledged</Badge> : <Button size="sm" icon={Check} onClick={() => ack.mutate(a)}>Acknowledge</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? "Edit announcement" : "New announcement"} size="lg" submitLabel={editing?._id ? "Save" : "Publish"} loading={save.isPending}
        disabled={!editing?.title?.trim() || editing.title.trim().length < 2 || !editing?.body?.trim()} onSubmit={() => save.mutate()}>
        <Field label="Title"><Input value={editing?.title || ""} maxLength={140} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
        <Field label="Message"><Textarea rows={6} value={editing?.body || ""} maxLength={5000} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
        <Field label="Show on calendar" optional><Input type="date" value={editing?.eventDay || ""} onChange={(e) => setEditing({ ...editing, eventDay: e.target.value })} /></Field>
        <SettingRow title="Important" description="Also emailed to members and highlighted."><Switch checked={editing?.important} onChange={(v) => setEditing({ ...editing, important: v })} label="Important" /></SettingRow>
        <SettingRow title="Pin to top"><Switch checked={editing?.pinned} onChange={(v) => setEditing({ ...editing, pinned: v })} label="Pinned" /></SettingRow>
      </FormModal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting)} loading={del.isPending} danger title="Delete announcement?" confirmLabel="Delete" />
    </div>
  );
}
