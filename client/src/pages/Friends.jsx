import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, MessageCircle, UserMinus, Check, X, Users, Clock } from "lucide-react";
import { api } from "../lib/api";
import { useOnline } from "../context/RealtimeContext";
import { useToast } from "../context/ToastContext";
import { useAction, useDebounced } from "../lib/hooks";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Input, LoadingBlock, PageHeader, Tabs } from "../components/ui";
import { timeAgo } from "../lib/format";
import { useT } from "../i18n/I18nProvider";

function FriendRow({ f, onMessage, onRemove }) {
  const online = useOnline(f._id, f.online);
  const t = useT();
  return (
    <div className="list-item">
      <Avatar user={f} size={38} online={online} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="strong text-sm truncate">{f.name}</div>
        <div className="text-xs muted truncate">{online ? t("members.online") : f.lastSeenAt ? t("friends.lastSeen", { ago: timeAgo(f.lastSeenAt) }) : f.bio || t("chat.offline")}</div>
      </div>
      <Button size="sm" icon={MessageCircle} onClick={() => onMessage(f)}>{t("friends.message")}</Button>
      <Button size="sm" variant="ghost" icon={UserMinus} aria-label={t("friends.removeName", { name: f.name })} onClick={() => onRemove(f)} />
    </div>
  );
}

export default function Friends() {
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "friends";
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [removing, setRemoving] = useState(null);
  const { data: friends, isLoading } = useQuery({ queryKey: ["friends"], queryFn: () => api.get("/friends") });
  const { data: reqs } = useQuery({ queryKey: ["friends", "requests"], queryFn: () => api.get("/friends/requests") });
  const { data: search, isFetching } = useQuery({ queryKey: ["user-search", dq], queryFn: () => api.get("/users/search", { q: dq }), enabled: tab === "find" && dq.trim().length >= 2 });

  const inv = [["friends"], ["user-search"], ["conversations"]];
  const add = useAction((u) => api.post("/friends/requests", { userId: u._id }), { invalidate: inv, success: (r) => (r.friendship.status === "accepted" ? t("friends.nowFriends") : t("friends.requestSent")) });
  const accept = useAction((r) => api.post(`/friends/requests/${r._id}/accept`), { invalidate: inv, success: t("friends.accepted") });
  const decline = useAction((r) => api.post(`/friends/requests/${r._id}/decline`), { invalidate: inv });
  const remove = useAction((f) => api.del(`/friends/${f._id}`), { invalidate: inv, success: t("friends.removed"), onSuccess: () => setRemoving(null) });
  const message = async (f) => {
    try {
      const r = await api.post("/chat/direct", { userId: f._id });
      navigate(`/friends/chat/${r.conversation._id}`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <main className="content content-narrow">
      <PageHeader title={t("nav.friends")} description={t("friends.desc")} />
      <Tabs value={tab} onChange={(v) => setParams({ tab: v })} items={[
        { value: "friends", label: t("nav.friends"), icon: Users },
        { value: "requests", label: t("nav.requests"), icon: Clock, count: reqs?.incoming?.length },
        { value: "find", label: t("friends.find"), icon: Search },
      ]} />
      {tab === "friends" && (
        <Card>
          {isLoading ? <LoadingBlock /> : !friends?.friends?.length ? (
            <EmptyState icon={Users} title={t("friends.none")} description={t("friends.noneHint")} action={<Button variant="primary" icon={UserPlus} onClick={() => setParams({ tab: "find" })}>{t("friends.find")}</Button>} />
          ) : (
            <div className="list">{friends.friends.map((f) => <FriendRow key={f._id} f={f} onMessage={message} onRemove={setRemoving} />)}</div>
          )}
        </Card>
      )}
      {tab === "requests" && (
        <div className="stack">
          <Card title={t("friends.received")}>
            {!reqs?.incoming?.length ? <EmptyState compact icon={Clock} title={t("members.noPending")} /> : (
              <div className="list">
                {reqs.incoming.map((r) => (
                  <div key={r._id} className="list-item">
                    <Avatar user={r.user} size={36} />
                    <div className="grow"><div className="strong text-sm">{r.user.name}</div><div className="text-xs muted">{timeAgo(r.createdAt)}</div></div>
                    <Button size="sm" variant="ghost" icon={X} onClick={() => decline.mutate(r)}>{t("requests.decline")}</Button>
                    <Button size="sm" variant="primary" icon={Check} onClick={() => accept.mutate(r)}>{t("friends.accept")}</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title={t("friends.sent")}>
            {!reqs?.outgoing?.length ? <EmptyState compact icon={UserPlus} title={t("friends.noneSent")} /> : (
              <div className="list">
                {reqs.outgoing.map((r) => (
                  <div key={r._id} className="list-item">
                    <Avatar user={r.user} size={36} />
                    <div className="grow"><div className="strong text-sm">{r.user.name}</div><div className="text-xs muted">{t("friends.sentAgo", { ago: timeAgo(r.createdAt) })}</div></div>
                    <Button size="sm" variant="ghost" onClick={() => decline.mutate(r)}>{t("common.cancel")}</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
      {tab === "find" && (
        <div className="stack">
          <div className="input-group"><Search /><Input autoFocus placeholder={t("friends.searchPlaceholder")} aria-label={t("friends.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Card>
            {dq.trim().length < 2 ? <EmptyState compact icon={Search} title={t("friends.searchTitle")} description={t("friends.searchHint")} /> : isFetching && !search ? <LoadingBlock rows={3} /> : !search?.users?.length ? (
              <EmptyState compact icon={Search} title={t("friends.noneFound")} />
            ) : (
              <div className="list">
                {search.users.map((u) => (
                  <div key={u._id} className="list-item">
                    <Avatar user={u} size={36} />
                    <div className="grow" style={{ minWidth: 0 }}><div className="strong text-sm">{u.name}</div>{u.bio && <div className="text-xs muted truncate">{u.bio}</div>}</div>
                    {u.relation === "friends" ? <Badge tone="success">{t("nav.friends")}</Badge> : u.relation === "requested" ? <Badge>{t("friends.requested")}</Badge> : (
                      <Button size="sm" variant={u.relation === "incoming" ? "primary" : "secondary"} icon={UserPlus} onClick={() => add.mutate(u)}>{u.relation === "incoming" ? t("friends.accept") : t("friends.add")}</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
      <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={() => remove.mutate(removing)} loading={remove.isPending} danger title={t("friends.removeTitle", { name: removing?.name })} confirmLabel={t("friends.removeSubmit")} description={t("friends.removeHint")} />
    </main>
  );
}
