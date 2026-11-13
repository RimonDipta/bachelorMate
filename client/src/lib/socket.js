import { io } from "socket.io-client";
import { apiBase, getAccessToken } from "./api";

let socket = null;

export function connectSocket() {
  if (socket) return socket;
  // VITE_SOCKET_URL lets the socket connect straight to the API host when the
  // REST API is reached through a proxy/rewrite (e.g. Vercel → Render).
  const url = import.meta.env.VITE_SOCKET_URL || apiBase || undefined;
  socket = io(url, {
    path: "/socket.io",
    // Fresh token on every (re)connect attempt.
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export const getSocket = () => socket;
