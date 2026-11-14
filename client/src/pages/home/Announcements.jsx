import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Megaphone, Pin, MoreHorizontal, Pencil, Trash2, Check, CalendarDays } from "lucide-react";
import { api } from "../../lib/api";
import { useHome } from "../../context/HomeContext";
import { useAuth } from "../../context/AuthContext";
import { useAction } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, FormModal, Input, LoadingBlock, Menu, MenuItem, PageHeader, SettingRow, Switch, Textarea } from "../../components/ui";
import { fmtDay, timeAgo } from "../../lib/format";
import { useT } from "../../i18n/I18nProvider";

export default function Announcements() {
  const { homeId, can } = useHome();
  const { user } = useAuth();
  const t = useT();
  const [editing, setEditing] = useState(null); // {} for new
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["announcements", homeId], queryFn: () => api.get(`/homes/${homeId}/announcements`) });
  const inv = [["announcements", homeId], ["dashboard", homeId], ["calendar"]];
  const save = useAction(() => {
    const body = { title: editing.title, body: editing.body, important: editing.important, pinned: editing.pinned, eventDay: editing.eventDay || "" };
    return editing._id ? api.patch(`/homes/${homeId}/announcements/${editing._id}`, body) : api.post(`/homes/${homeId}/announcements`, body);
  }, { invalidate: inv, success: () => (editing?._id ? t("announce.updated") : t("announce.published")), onSuccess: () => setEditing(null) });
  const del = useAction((a) => api.del(`/homes/${homeId}/announcements/${a._id}`), { invalidate: inv, success: t("announce.deleted"), onSuccess: () => setDeleting(null) });
  const ack = useAction((a) => api.post(`/homes/${homeId}/announcements/${a._id}/acknowledge`), { invalidate: inv, success: t("announce.acknowledgedToast") });
  const manage = can("announcements.manage");

  return (
    <div className="content-narrow" style={{ margin: "0 auto" }}>
      <PageHeader title={t("nav.announcements")} description={t("announce.desc")} actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEditing({ title: "", body: "", important: false, pinned: false, eventDay: "" })}>{t("announce.new")}</Button>} />
      {isLoading ? <Card><LoadingBlock /></Card> : !data.announcements.length ? (
        <Card><EmptyState icon={Megaphone} title={t("dashboard.noAnnouncements")} description={manage ? t("announce.noneManage") : t("announce.noneMember")} /></Card>
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
                      {a.pinned && <Badge icon={Pin}>{t("announce.pinned")}</Badge>}
                      {a.important && <Badge tone="danger">{t("dashboard.important")}</Badge>}
                      {manage && (
                        <Menu trigger={<Button size="sm" variant="ghost" icon={MoreHorizontal} aria-label={t("announce.actions")} />}>
                          <MenuItem icon={Pencil} onClick={() => setEditing({ ...a, eventDay: a.eventDay || "" })}>{t("common.edit")}</MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => setDeleting(a)}>{t("common.delete")}</MenuItem>
                        </Menu>
                      )}
                    </div>
                  </div>
                  <h2>{a.title}</h2>
                  <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-2)" }}>{a.body}</p>
                  {a.eventDay && <div className="row text-sm muted"><CalendarDays size={14} /> {fmtDay(a.eventDay, { weekday: "long", month: "long", day: "numeric" })}</div>}
                </div>
                <div className="card-foot row between">
                  <span className="text-xs muted">{t("announce.ackCount", { n: a.acknowledgements.length })}{manage && a.acknowledgements.length > 0 ? `: ${a.acknowledgements.map((x) => x.user?.name).filter(Boolean).join(", ")}` : ""}</span>
                  {acked ? <Badge tone="success" icon={Check}>{t("announce.youAcked")}</Badge> : <Button size="sm" icon={Check} onClick={() => ack.mutate(a)}>{t("announce.acknowledge")}</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?._id ? t("announce.editTitle") : t("announce.new")} size="lg" submitLabel={editing?._id ? t("common.save") : t("announce.publish")} loading={save.isPending}
        disabled={!editing?.title?.trim() || editing.title.trim().length < 2 || !editing?.body?.trim()} onSubmit={() => save.mutate()}>
        <Field label={t("forms.title")}><Input value={editing?.title || ""} maxLength={140} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
        <Field label={t("announce.message")}><Textarea rows={6} value={editing?.body || ""} maxLength={5000} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
        <Field label={t("announce.showOnCalendar")} optional><Input type="date" value={editing?.eventDay || ""} onChange={(e) => setEditing({ ...editing, eventDay: e.target.value })} /></Field>
        <SettingRow title={t("dashboard.important")} description={t("announce.importantHint")}><Switch checked={editing?.important} onChange={(v) => setEditing({ ...editing, important: v })} label={t("dashboard.important")} /></SettingRow>
        <SettingRow title={t("announce.pinTop")}><Switch checked={editing?.pinned} onChange={(v) => setEditing({ ...editing, pinned: v })} label={t("announce.pinTop")} /></SettingRow>
      </FormModal>
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting)} loading={del.isPending} danger title={t("announce.deleteTitle")} confirmLabel={t("common.delete")} />
    </div>
  );
}
