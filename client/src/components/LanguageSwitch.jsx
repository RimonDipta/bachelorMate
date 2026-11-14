import { Languages } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { LANGUAGES } from "../i18n";

/**
 * One-tap switch to the other language. The button is labelled in the
 * language it switches to, so someone who can't read the current one still
 * finds it.
 */
export function LanguageSwitch({ className = "lang-switch" }) {
  const { lang, setLanguage, t } = useI18n();
  const other = LANGUAGES.find((l) => l.value !== lang);
  return (
    <button
      type="button"
      className={className}
      lang={other.value}
      onClick={() => setLanguage(other.value)}
      aria-label={t("language.switchTo", { language: other.label })}
      title={t("language.switchTo", { language: other.label })}
    >
      <Languages aria-hidden size={16} />
      <span>{other.label}</span>
    </button>
  );
}
