// API client. The short-lived access token lives only in memory; the
// refresh token is an httpOnly cookie, so a page reload silently refreshes.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

let accessToken = null;
let refreshing = null;
let authLostHandler = () => {};

export class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

// Requests that are taking a while (slow network, or the server waking up) — the UI shows a hint.
const SLOW_MS = 4000;
let slowCount = 0;
const slowListeners = new Set();
const setSlow = (d) => { slowCount += d; slowListeners.forEach((fn) => fn(slowCount)); };
export const onSlowRequests = (fn) => (slowListeners.add(fn), () => slowListeners.delete(fn));

export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => (accessToken = t);
export const onAuthLost = (fn) => (authLostHandler = fn);
export const assetUrl = (p) => (p && (p.startsWith("/uploads") || p.startsWith("/api/files/")) ? `${BASE}${p}` : p);
export const apiBase = BASE;

export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new ApiError(r.status, data.message || "Session expired");
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => (refreshing = null));
  }
  return refreshing;
}

const qs = (query) => {
  if (!query) return "";
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function request(path, { method = "GET", body, query, raw = false, retry = true } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  let slow = false;
  const slowTimer = setTimeout(() => { slow = true; setSlow(1); }, SLOW_MS);
  try {
    // Generous limit: a sleeping free-tier server can take ~a minute to wake; uploads get longer.
    const timeout = AbortSignal.timeout(body instanceof FormData ? 180_000 : 90_000);
    res = await fetch(`${BASE}/api${path}${qs(query)}`, { method, headers, body: payload, credentials: "include", signal: timeout });
  } catch (err) {
    if (err?.name === "TimeoutError") throw new ApiError(0, "The server took too long to respond. Please try again.", undefined, "TIMEOUT");
    throw new ApiError(0, navigator.onLine === false ? "You're offline. Check your connection." : "Can't reach the server. Check your connection.", undefined, "NETWORK");
  } finally {
    clearTimeout(slowTimer);
    if (slow) setSlow(-1);
  }

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    try {
      await refreshSession();
      return request(path, { method, body, query, raw, retry: false });
    } catch {
      accessToken = null;
      authLostHandler();
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
  }
  if (raw) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, data.message || "Request failed");
    }
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message || "Something went wrong", data.details, data.code);
  return data;
}

export const api = {
  get: (p, query) => request(p, { query }),
  post: (p, body) => request(p, { method: "POST", body }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
  put: (p, body) => request(p, { method: "PUT", body }),
  del: (p, body) => request(p, { method: "DELETE", body }),
  /** Fetch an authenticated file and trigger a browser download. */
  async download(p, query, filename) {
    const res = await request(p, { query, raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  /** Open a stored file: new uploads live at /api/files/<id>, older ones under the home. */
  openFile(stored, homeId) {
    return this.open(stored.startsWith("/api/") ? stored.slice(4) : `/homes/${homeId}/files/${stored}`);
  },
  /** Open an authenticated file (e.g. a receipt) in a new tab. */
  async open(p) {
    const win = window.open("", "_blank");
    const res = await request(p, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.location.href = url;
  },
};
