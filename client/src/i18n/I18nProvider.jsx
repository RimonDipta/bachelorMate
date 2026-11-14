/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { applyLanguage, getLanguage, localeTag, translate } from "./index";

const I18nContext = createContext({ lang: "en", locale: "en-US", t: translate, setLanguage: () => {} });

export function I18nProvider({ children }) {
  const { user } = useAuth();
  const [lang, setLang] = useState(getLanguage);
  const [syncedFor, setSyncedFor] = useState(null);

  // The account's saved language wins when signing in on a new device
  // (adjusted during render, like ThemeProvider does for appearance).
  if (user && syncedFor !== user._id) {
    setSyncedFor(user._id);
    const saved = user.appearance?.language;
    if (saved && saved !== lang) setLang(saved);
  }

  // Keep the module-level language (read by lib/format.js) in step before children render.
  applyLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLanguage = useCallback(
    (next) => {
      setLang(next);
      if (user) api.patch("/users/me/preferences", { appearance: { language: next } }).catch(() => {});
    },
    [user]
  );

  // `t` is a new function per language so memoised consumers re-render.
  const value = useMemo(() => ({ lang, locale: localeTag(lang), t: (k, v) => translate(k, v), setLanguage }), [lang, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
/** The translate function for the current language: const t = useT(); t("nav.meals") */
export const useT = () => useContext(I18nContext).t;
