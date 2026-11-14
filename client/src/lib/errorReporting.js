// Sends browser crashes to the server (/api/client-errors), which logs them and
// forwards them to Sentry when configured. Deduplicated and capped per page load.
import { apiBase } from "./api";

const sent = new Set();
let budget = 10;
// eslint-disable-next-line no-undef -- injected by vite.config.js
export const RELEASE = typeof __APP_RELEASE__ !== "undefined" ? __APP_RELEASE__ : undefined;

export function reportError(error, { kind = "error", componentStack } = {}) {
  try {
    if (import.meta.env.DEV || budget <= 0) return;
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    // Network hiccups and aborted requests aren't bugs.
    if (/Failed to fetch|NetworkError|Load failed|AbortError|ResizeObserver loop/i.test(err.message)) return;
    const key = `${err.message}|${(err.stack || "").split("\n")[1] || ""}`;
    if (sent.has(key)) return;
    sent.add(key);
    budget -= 1;
    const body = JSON.stringify({
      kind,
      name: err.name?.slice(0, 100),
      message: err.message.slice(0, 500) || "Error",
      stack: err.stack?.slice(0, 4000),
      componentStack: componentStack?.slice(0, 2000),
      url: window.location.pathname,
      release: RELEASE,
    });
    const url = `${apiBase}/api/client-errors`;
    // sendBeacon survives page unloads; fall back to fetch.
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" })))) {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "include" }).catch(() => {});
    }
  } catch {
    /* reporting must never throw */
  }
}

export function installGlobalErrorHandlers() {
  window.addEventListener("error", (e) => reportError(e.error || e.message, { kind: "error" }));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    // API errors (4xx answers) are handled by the UI already.
    if (r && typeof r.status === "number" && r.status > 0 && r.status < 500) return;
    reportError(r, { kind: "rejection" });
  });
}
