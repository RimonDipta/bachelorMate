import { Link } from "react-router-dom";
import { Check, ChevronRight, UserPlus, Repeat, Utensils, Receipt, X } from "lucide-react";
import { api } from "../lib/api";
import { useAction } from "../lib/hooks";
import { Button } from "./ui";
import { useT } from "../i18n/I18nProvider";

/** "Get your home set up" — the first things a new home needs, ticked off from real data. */
export default function SetupChecklist({ homeId, setup, can }) {
  const base = `/h/${homeId}`;
  const t = useT();
  const dismiss = useAction(() => api.post(`/homes/${homeId}/setup/dismiss`), { invalidate: [["dashboard", homeId], ["home", homeId]] });

  const steps = [
    { key: "invited", icon: UserPlus, title: t("setup.invite"), hint: t("setup.inviteHint"), to: `${base}/invites`, show: true },
    { key: "recurring", icon: Repeat, title: t("setup.recurring"), hint: t("setup.recurringHint"), to: `${base}/finance/recurring?new=1`, show: can("expenses.manage") },
    { key: "meals", icon: Utensils, title: t("setup.meals"), hint: t("setup.mealsHint"), to: `${base}/meals/daily`, show: can("meals.manage") },
    { key: "expenses", icon: Receipt, title: t("setup.bazar"), hint: t("setup.bazarHint"), to: `${base}/finance/expenses?new=1`, show: can("expenses.manage", "expenses.meal") },
  ].filter((s) => s.show);

  const done = steps.filter((s) => setup[s.key]).length;
  const allDone = done === steps.length;
  const next = steps.find((s) => !setup[s.key]);

  return (
    <section className="card setup" aria-labelledby="setup-title">
      <div className="setup-head">
        <div className="grow">
          <h2 id="setup-title" className="setup-title">{allDone ? t("setup.ready") : t("setup.title")}</h2>
          <p className="text-sm muted">{allDone ? t("setup.readyHint") : t("setup.progress", { done, total: steps.length })}</p>
        </div>
        <Button variant={allDone ? "primary" : "ghost"} size="sm" icon={allDone ? Check : X} loading={dismiss.isPending} onClick={() => dismiss.mutate()} aria-label={allDone ? t("setup.hide") : t("setup.dismissLabel")}>
          {allDone ? t("setup.done") : <span className="hide-sm">{t("setup.dismiss")}</span>}
        </Button>
      </div>
      <div className="bar-track setup-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label={t("setup.progressLabel")}>
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="setup-steps">
        {steps.map((s) => {
          const ok = setup[s.key];
          const I = s.icon;
          return (
            <li key={s.key}>
              <Link to={s.to} className={`setup-step ${ok ? "is-done" : ""} ${next === s ? "is-next" : ""}`}>
                <span className="setup-check" aria-hidden>{ok ? <Check size={14} /> : <I size={15} />}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="setup-step-title">{s.title}<span className="sr-only">{ok ? ` (${t("setup.doneMark")})` : ""}</span></span>
                  <span className="setup-step-hint">{s.hint}</span>
                </span>
                {!ok && <ChevronRight size={16} className="subtle" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
