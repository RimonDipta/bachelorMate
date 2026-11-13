import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Smile, Pencil, Trash2, ArrowLeft, CheckCheck, MessagesSquare } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useRealtime, useOnline } from "../context/RealtimeContext";
import { useToast } from "../context/ToastContext";
import { Avatar, Button, EmptyState, ErrorState, FormModal, LoadingBlock, Textarea, Badge, Field } from "./ui";
import { fmtTime, timeAgo, ROLE_LABEL } from "../lib/format";

const EMOJI = ["😀", "😂", "😍", "🥲", "😎", "🤔", "😴", "😡", "👍", "👎", "🙏", "👏", "🔥", "🎉", "❤️", "💯", "🍛", "🍚", "🍗", "🥘", "☕", "🛒", "💸", "✅"];

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

function MemberRow({ m }) {
  const online = useOnline(m._id, m.online);
  return (
    <div className="list-item" style={{ padding: "8px 14px" }}>
      <Avatar user={m} size={28} online={online} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="text-sm truncate">{m.name}</div>
        <div className="text-xs subtle">{online ? "Online" : m.lastSeenAt ? `Seen ${timeAgo(m.lastSeenAt)}` : "Offline"}</div>
      </div>
      {m.roles && !m.roles.includes("member") && <Badge>{ROLE_LABEL[m.roles[0]]}</Badge>}
    </div>
  );
}

export default function ChatView({ conversationId, title, subtitle, avatar, onBack, showMembers = true, emptyHint }) {
  const { user } = useAuth();
  const { socket, typing } = useRealtime();
  const toast = useToast();
  const qc = useQueryClient();
  const key = ["messages", String(conversationId)];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api.get(`/chat/${conversationId}/messages`), staleTime: 60_000 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scroller = useRef(null);
  const stick = useRef(true);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const messages = useMemo(() => data?.messages || [], [data]);

  // Mark as read whenever new messages arrive while open.
  const lastId = messages[messages.length - 1]?._id;
  useEffect(() => {
    if (!lastId || document.hidden) return;
    const t = setTimeout(() => {
      api.post(`/chat/${conversationId}/read`).then(() => qc.invalidateQueries({ queryKey: ["conversations"] })).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [lastId, conversationId, qc]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversationId]);

  useEffect(() => () => {
    socket?.emit("chat:typing", { conversationId, typing: false });
  }, [socket, conversationId]);

  const onScroll = () => {
    const el = scroller.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const el = scroller.current;
      const prevHeight = el.scrollHeight;
      const r = await api.get(`/chat/${conversationId}/messages`, { before: messages[0].createdAt });
      qc.setQueryData(key, (old) => ({ ...old, messages: [...r.messages, ...old.messages], hasMore: r.hasMore }));
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - prevHeight));
    } finally {
      setLoadingOlder(false);
    }
  };

  const emitTyping = (on) => {
    if (!socket) return;
    if (on && Date.now() - lastTypingSent.current < 2000) return;
    lastTypingSent.current = on ? Date.now() : 0;
    socket.emit("chat:typing", { conversationId, typing: on });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await api.post(`/chat/${conversationId}/messages`, { body });
      stick.current = true;
      qc.setQueryData(key, (old) => (old && !old.messages.some((m) => m._id === r.message._id) ? { ...old, messages: [...old.messages, r.message] } : old));
      setText("");
      emitTyping(false);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e);
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/chat/messages/${editing._id}`, { body: editing.body });
      setEditing(null);
    } catch (e) {
      toast.error(e);
    }
  };
  const remove = async (m) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    api.del(`/chat/messages/${m._id}`).catch((e) => toast.error(e));
  };

  const typers = Object.entries(typing[conversationId] || {}).filter(([uid]) => uid !== user._id).map(([, n]) => n.split(" ")[0]);
  const otherReads = (data?.reads || []).filter((r) => String(r.user) !== String(user._id));
  const myLast = [...messages].reverse().find((m) => m.sender?._id === user._id && !m.deletedAt);
  const seenBy = myLast ? otherReads.filter((r) => new Date(r.lastReadAt) >= new Date(myLast.createdAt)).length : 0;

  // Group consecutive messages by the same sender within 5 minutes.
  const groups = [];
  messages.forEach((m) => {
    const last = groups[groups.length - 1];
    const sameDay = last && new Date(last.items[0].createdAt).toDateString() === new Date(m.createdAt).toDateString();
    if (last && sameDay && last.sender?._id === m.sender?._id && new Date(m.createdAt) - new Date(last.items[last.items.length - 1].createdAt) < 5 * 60000) last.items.push(m);
    else groups.push({ sender: m.sender, items: [m], newDay: !sameDay });
  });

  return (
    <div className={showMembers ? "chat card" : "chat-main"} style={showMembers ? undefined : { height: "100%" }}>
      <div className="chat-main" style={{ flex: 1, minHeight: 0 }}>
        <div className="chat-head">
          {onBack && <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} aria-label="Back" className="show-sm" />}
          {avatar}
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong text-sm truncate">{title}</div>
            {subtitle && <div className="text-xs muted truncate">{subtitle}</div>}
          </div>
        </div>
        <div className="chat-scroll" ref={scroller} onScroll={onScroll} aria-live="polite">
          {isLoading ? <LoadingBlock rows={4} /> : error ? <ErrorState error={error} retry={refetch} /> : messages.length === 0 ? (
            <EmptyState icon={MessagesSquare} title="No messages yet" description={emptyHint || "Say hello 👋"} />
          ) : (
            <>
              {data.hasMore && <div style={{ textAlign: "center" }}><Button size="sm" variant="ghost" loading={loadingOlder} onClick={loadOlder}>Load earlier messages</Button></div>}
              {groups.map((g) => {
                const mine = g.sender?._id === user._id;
                return (
                  <Fragment key={g.items[0]._id}>
                    {g.newDay && <div className="day-sep">{dayLabel(g.items[0].createdAt)}</div>}
                    <div className={`msg-group ${mine ? "mine" : ""}`}>
                      {!mine && <Avatar user={g.sender} size={28} />}
                      <div className="msg-bodies">
                        <div className="msg-meta">{!mine && <span className="strong" style={{ color: "var(--text-2)" }}>{g.sender?.name}</span>}<span>{fmtTime(g.items[0].createdAt)}</span></div>
                        {g.items.map((m) => (
                          <div key={m._id} className="msg-row">
                            <div className={`msg ${m.deletedAt ? "deleted" : ""}`}>
                              {m.deletedAt ? "Message deleted" : m.body}
                              {m.editedAt && !m.deletedAt && <span style={{ opacity: 0.7, fontSize: 11 }}> (edited)</span>}
                            </div>
                            {mine && !m.deletedAt && (
                              <div className="msg-actions">
                                <Button size="sm" variant="ghost" icon={Pencil} aria-label="Edit message" onClick={() => setEditing({ _id: m._id, body: m.body })} />
                                <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete message" onClick={() => remove(m)} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {myLast && seenBy > 0 && (
                <div className="msg-meta" style={{ justifyContent: "flex-end", marginTop: 4 }}><CheckCheck size={13} /> {otherReads.length === 1 ? "Seen" : `Seen by ${seenBy}`}</div>
              )}
            </>
          )}
        </div>
        <div className="typing">{typers.length > 0 && `${typers.slice(0, 3).join(", ")} ${typers.length > 1 ? "are" : "is"} typing…`}</div>
        <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <Button variant="ghost" icon={Smile} aria-label="Insert emoji" onClick={() => setEmoji(!emoji)} />
          {emoji && (
            <div className="menu emoji-pop">
              {EMOJI.map((e) => <button type="button" key={e} onClick={() => { setText((t) => t + e); setEmoji(false); }}>{e}</button>)}
            </div>
          )}
          <Textarea
            rows={1}
            value={text}
            maxLength={4000}
            placeholder="Write a message…"
            aria-label="Message"
            onChange={(e) => {
              setText(e.target.value);
              emitTyping(true);
              clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(() => emitTyping(false), 3000);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button type="submit" variant="primary" icon={Send} aria-label="Send" loading={sending} disabled={!text.trim()} />
        </form>
      </div>
      {showMembers && (
        <aside className="chat-side">
          <div className="card-head" style={{ minHeight: 49 }}><h3>Members · {data?.members?.length || 0}</h3></div>
          {(data?.members || []).map((m) => <MemberRow key={m._id} m={m} />)}
        </aside>
      )}
      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit message" onSubmit={saveEdit} disabled={!editing?.body?.trim()}>
        <Field label="Message"><Textarea value={editing?.body || ""} maxLength={4000} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></Field>
      </FormModal>
    </div>
  );
}
