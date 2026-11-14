import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import { useOnline } from "../context/RealtimeContext";
import { useToast } from "../context/ToastContext";
import { Avatar, EmptyState, LoadingBlock } from "../components/ui";
import ChatView from "../components/ChatView";
import { num, timeAgo } from "../lib/format";
import { useT } from "../i18n/I18nProvider";

function ConvItem({ c, active }) {
  const online = useOnline(c.other?._id, c.other?.online);
  const t = useT();
  return (
    <Link to={`/friends/chat/${c._id}`} className={`list-item ${c.unread ? "unread" : ""}`} style={active ? { background: "var(--accent-soft)" } : undefined}>
      <Avatar user={c.other} size={36} online={online} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row between"><span className={`text-sm truncate ${c.unread ? "strong" : ""}`}>{c.other?.name}</span><span className="text-xs subtle">{timeAgo(c.lastMessageAt)}</span></div>
        {c.kind === "listing" && <div className="text-xs truncate" style={{ color: "var(--accent-text)" }}>{t("messages.seat", { title: c.listing?.title || t("messages.listing") })}</div>}
        <div className="row between"><span className="text-xs muted truncate">{c.lastMessage?.body}</span>{c.unread > 0 && <span className="count">{num(c.unread)}</span>}</div>
      </div>
    </Link>
  );
}

function FriendStart({ f }) {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline(f._id, f.online);
  const start = async () => {
    try {
      const r = await api.post("/chat/direct", { userId: f._id });
      navigate(`/friends/chat/${r.conversation._id}`);
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <button className="list-item" onClick={start} style={{ width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}>
      <Avatar user={f} size={30} online={online} />
      <span className="grow text-sm truncate">{f.name}</span>
      <MessageCircle size={15} className="subtle" />
    </button>
  );
}

export default function Messages() {
  const { cid } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["conversations"], queryFn: () => api.get("/chat/conversations") });
  const { data: friends } = useQuery({ queryKey: ["friends"], queryFn: () => api.get("/friends") });
  const dms = (data?.conversations || []).filter((c) => c.kind === "direct" || c.kind === "listing");
  const active = dms.find((c) => c._id === cid);
  const withoutChat = (friends?.friends || []).filter((f) => !dms.some((c) => c.other?._id === f._id));
  const otherOnline = useOnline(active?.other?._id, active?.other?.online);

  return (
    <main className="content" style={{ maxWidth: 1180 }}>
      <div className={`chat-list-layout card ${cid ? "has-active" : ""}`}>
        <div className="conv-list" style={{ borderRight: "1px solid var(--border)", overflowY: "auto", minHeight: 0 }}>
          <div className="card-head"><h2>{t("nav.messages")}</h2><Link to="/friends?tab=find" className="btn btn-ghost btn-sm"><UserPlus size={15} /> {t("messages.addFriends")}</Link></div>
          {isLoading ? <LoadingBlock rows={3} /> : (
            <>
              {dms.map((c) => <ConvItem key={c._id} c={c} active={c._id === cid} />)}
              {withoutChat.length > 0 && <div className="nav-section" style={{ padding: "14px 20px 4px" }}>{t("messages.startChat")}</div>}
              {withoutChat.map((f) => <FriendStart key={f._id} f={f} />)}
              {!dms.length && !withoutChat.length && <EmptyState compact icon={MessageCircle} title={t("messages.none")} description={t("messages.noneHint")} action={<Link to="/friends?tab=find" className="btn btn-primary">{t("messages.findFriends")}</Link>} />}
            </>
          )}
        </div>
        {cid ? (
          <ChatView
            key={cid}
            conversationId={cid}
            showMembers={false}
            onBack={() => navigate("/messages")}
            title={active?.other?.name || t("messages.conversation")}
            subtitle={active?.kind === "listing" ? t("messages.aboutListing", { title: active.listing?.title || "" }) : active?.other ? (otherOnline ? t("members.online") : active.other.lastSeenAt ? t("friends.lastSeen", { ago: timeAgo(active.other.lastSeenAt) }) : t("chat.offline")) : ""}
            avatar={active?.other && <Avatar user={active.other} size={32} online={otherOnline} />}
          />
        ) : (
          <div className="chat-main" style={{ display: "grid", placeItems: "center" }}>
            <EmptyState icon={MessageCircle} title={t("messages.yours")} description={t("messages.yoursHint")} />
          </div>
        )}
      </div>
    </main>
  );
}
