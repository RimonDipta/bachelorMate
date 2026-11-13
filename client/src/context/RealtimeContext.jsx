/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket, getSocket } from "../lib/socket";
import { refreshSession } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const RealtimeContext = createContext({ presence: {}, typing: {}, socket: null });

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [presence, setPresence] = useState({});
  const [typing, setTyping] = useState({}); // conversationId -> { userId: name }

  useEffect(() => {
    if (!user) return;
    const s = connectSocket();
    const inv = (key) => qc.invalidateQueries({ queryKey: key });

    const handlers = {
      connect_error: async (err) => {
        // Access token expired: refresh, and socket.io retries with the new one.
        if (err.message === "unauthorized") await refreshSession().catch(() => {});
      },
      "notification:new": (n) => {
        inv(["notifications"]);
        if (n.type !== "message") toast.info(n.body || "", { title: n.title });
      },
      "chat:message": ({ conversationId, message }) => {
        qc.setQueryData(["messages", String(conversationId)], (old) => {
          if (!old || old.messages.some((m) => m._id === message._id)) return old;
          return { ...old, messages: [...old.messages, message] };
        });
        inv(["conversations"]);
        setTyping((t) => {
          const c = { ...(t[conversationId] || {}) };
          delete c[message.sender?._id];
          return { ...t, [conversationId]: c };
        });
      },
      "chat:message:updated": ({ conversationId, message }) => {
        qc.setQueryData(["messages", String(conversationId)], (old) => old && { ...old, messages: old.messages.map((m) => (m._id === message._id ? message : m)) });
      },
      "chat:read": ({ conversationId, userId, at }) => {
        qc.setQueryData(["messages", String(conversationId)], (old) => {
          if (!old) return old;
          const reads = old.reads.filter((r) => String(r.user) !== String(userId));
          return { ...old, reads: [...reads, { user: userId, lastReadAt: at }] };
        });
      },
      "chat:typing": ({ conversationId, userId, name, typing: on }) => {
        setTyping((t) => {
          const c = { ...(t[conversationId] || {}) };
          if (on) c[userId] = name;
          else delete c[userId];
          return { ...t, [conversationId]: c };
        });
      },
      presence: ({ userId, online }) => setPresence((p) => ({ ...p, [userId]: online })),
      "meals:changed": () => inv(["meals"]),
      "finance:changed": () => {
        inv(["finance"]);
        inv(["expenses"]);
        inv(["dashboard"]);
      },
      "grocery:changed": () => inv(["grocery"]),
      "announcement:new": () => inv(["announcements"]),
      "activity:new": () => inv(["activity"]),
      "home:removed": () => {
        inv(["homes"]);
        inv(["home"]);
      },
    };
    Object.entries(handlers).forEach(([e, h]) => s.on(e, h));
    return () => {
      Object.entries(handlers).forEach(([e, h]) => s.off(e, h));
    };
  }, [user, qc, toast]);

  useEffect(() => {
    if (!user) disconnectSocket();
  }, [user]);

  const value = useMemo(() => ({ get socket() { return getSocket(); }, presence, typing }), [presence, typing]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

/** Online status: live presence events override the server snapshot. */
export function useOnline(userId, fallback) {
  const { presence } = useRealtime();
  return presence[userId] ?? fallback;
}
