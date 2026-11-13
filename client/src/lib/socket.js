import { io } from "socket.io-client";
import { apiBase, getAccessToken } from "./api";

let socket = null;

export function connectSocket() {
  if (socket) return socket;
  socket = io(apiBase || undefined, {
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
