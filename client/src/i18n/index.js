// Tiny i18n core: two JSON dictionaries, dot-path keys, {var} interpolation
// and a `_one` / `_other` plural pick. The active language lives here as
// module state so plain helpers (lib/format.js, label maps) can read it too;
// I18nProvider keeps it in sync with React state and re-renders on change.
import en from "./en.json";
import bn from "./bn.json";

const DICTS = { en, bn };
export const LANGUAGES = [
  { value: "en", label: "English", short: "EN" },
  { value: "bn", label: "বাংলা", short: "বাং" },
];
const STORAGE_KEY = "bm_lang";
const isLang = (l) => l === "en" || l === "bn";

/** Saved choice on this device, else the browser language, else English. */
export function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const langs = typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : [];
  return langs.some((l) => /^bn\b/i.test(l || "")) ? "bn" : "en";
}

let current = detectLanguage();

export const getLanguage = () => current;
/** BCP 47 tag for Intl: bn-BD gives Bangla digits and Bangladeshi grouping. */
export const localeTag = (lang = current) => (lang === "bn" ? "bn-BD" : "en-US");

export function applyLanguage(lang) {
  if (!isLang(lang) || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

const lookup = (dict, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);

const numberFormatters = new Map();
export function formatNumber(n, opts) {
  const key = `${current}|${JSON.stringify(opts || {})}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat(localeTag(), opts));
  return numberFormatters.get(key).format(n);
}

function pick(dict, key, vars) {
  if (vars && typeof vars.count === "number") {
    const form = lookup(dict, `${key}_${vars.count === 1 ? "one" : "other"}`);
    if (typeof form === "string") return form;
  }
  const v = lookup(dict, key);
  return typeof v === "string" ? v : undefined;
}

/** t("nav.meals"), t("meals.count", { count: 3 }). Numbers are formatted in the active locale. */
export function translate(key, vars) {
  const raw = pick(DICTS[current], key, vars) ?? pick(en, key, vars);
  if (raw === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => {
    const v = vars[name];
    if (v === undefined || v === null) return "";
    return typeof v === "number" ? formatNumber(v) : String(v);
  });
}

/** Like translate, but returns `fallback` when neither dictionary has the key. */
export function translateOr(key, fallback, vars) {
  return pick(DICTS[current], key, vars) ?? pick(en, key, vars) ? translate(key, vars) : fallback;
}

/** An object whose values are translated on every read, e.g. ROLE_LABEL.admin. */
export function labelMap(prefix, keys) {
  const obj = {};
  for (const k of keys) Object.defineProperty(obj, k, { enumerable: true, get: () => translate(`${prefix}.${k}`) });
  return obj;
}
