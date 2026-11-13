/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const KEY = "bm_theme";
const DEFAULTS = { mode: "system", accent: "violet", preset: "default", density: "comfortable" };

export const ACCENTS = [
  { value: "violet", color: "#7c3aed" },
  { value: "indigo", color: "#4f46e5" },
  { value: "blue", color: "#2563eb" },
  { value: "teal", color: "#0d9488" },
  { value: "emerald", color: "#059669" },
  { value: "rose", color: "#e11d48" },
  { value: "amber", color: "#d97706" },
];

const read = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
};

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(read);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [syncedFor, setSyncedFor] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // The account's saved appearance wins when signing in on a new device
  // (adjusted during render, React's recommended alternative to an effect).
  if (user?.appearance && syncedFor !== user._id) {
    setSyncedFor(user._id);
    setPrefs({ ...DEFAULTS, ...user.appearance });
  }

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [prefs]);

  const resolved = prefs.mode === "system" ? (systemDark ? "dark" : "light") : prefs.mode;

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = resolved;
    el.dataset.accent = prefs.accent;
    el.dataset.preset = prefs.preset;
    el.dataset.density = prefs.density;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === "dark" ? "#09090b" : "#ffffff";
  }, [resolved, prefs]);

  const update = useCallback(
    (patch) => {
      setPrefs((p) => ({ ...p, ...patch }));
      if (user) api.patch("/users/me/preferences", { appearance: patch }).catch(() => {});
    },
    [user]
  );

  const value = useMemo(() => ({ ...prefs, resolved, update }), [prefs, resolved, update]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
