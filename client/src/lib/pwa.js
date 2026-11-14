// Installable app (PWA): service worker, "Install app" prompt and push notifications.
import { translate } from "../i18n";
import { useEffect, useState } from "react";
import { api } from "./api";

// ---------- service worker ----------
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// ---------- install prompt ----------
// Chrome/Edge/Samsung fire `beforeinstallprompt` once, early — keep it for later.
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const isIOS = () =>
  typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/**
 * { canInstall, installed, ios, promptInstall }
 * canInstall: the browser offered a one-tap install, or it's iOS Safari (manual steps).
 */
export function useInstallPrompt() {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  const installed = isStandalone();
  const ios = isIOS();
  return {
    installed,
    ios,
    native: Boolean(deferred),
    canInstall: !installed && (Boolean(deferred) || ios),
    async promptInstall() {
      if (!deferred) return "unavailable";
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      emit();
      return outcome; // "accepted" | "dismissed"
    },
  };
}

// ---------- push notifications ----------
const b64ToBytes = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** "unsupported" | "needs-install" (iOS outside the installed app) | "off-server" | "denied" | "on" | "off" */
export async function getPushState() {
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  const cfg = await api.get("/push/config").catch(() => ({ enabled: false }));
  if (!cfg.enabled) return "off-server";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush() {
  const cfg = await api.get("/push/config");
  if (!cfg.enabled) throw new Error(translate("settings.notifications.pushHint.off-server"));
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(translate("hooks.pushBlocked"));
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) }));
  await api.post("/push/subscriptions", sub.toJSON());
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.del("/push/subscriptions", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
