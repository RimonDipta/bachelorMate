/* eslint-disable react-refresh/only-export-components */
import { Wand2, Users, UserCheck, SlidersHorizontal, Landmark } from "lucide-react";
import { Avatar, Badge, Input, Segmented } from "./ui";
import { money } from "../lib/format";
import { allocate, minorToInput, parseMinor } from "../lib/money";
import { useT } from "../i18n/I18nProvider";
import { translate } from "../i18n";

/**
 * Split state shape:
 *   { mode: "equal" | "custom" | "none", allMembers: bool, memberships: [id], shares: { [id]: "12.50" } }
 */
export const emptySplit = () => ({ mode: "equal", allMembers: true, memberships: [], shares: {} });

/** Per-member amounts (minor units) for a split — mirrors the server's maths. */
export function computeShares(split, members, totalMinor) {
  if (!totalMinor || split.mode === "none") return {};
  if (split.mode === "custom") {
    return Object.fromEntries(members.map((m) => [m._id, parseMinor(split.shares[m._id] || "0") ?? 0]));
  }
  const ids = split.allMembers ? members.map((m) => m._id) : members.filter((m) => split.memberships.includes(m._id)).map((m) => m._id);
  const parts = allocate(totalMinor, ids.map(() => 1));
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

/** Problems that would make the server reject the split (shown inline). */
export function splitError(split, members, totalMinor) {
  if (!totalMinor || split.mode === "none") return "";
  if (split.mode === "equal" && !split.allMembers && !split.memberships.length) return translate("split.chooseOne");
  if (split.mode === "custom") {
    if (members.some((m) => split.shares[m._id] && parseMinor(split.shares[m._id]) === null)) return translate("split.badAmount");
    const sum = Object.values(computeShares(split, members, totalMinor)).reduce((a, b) => a + b, 0);
    if (sum !== totalMinor) return sum < totalMinor ? "remaining" : "over";
  }
  return "";
}

export default function SplitEditor({ value: split, onChange, members, totalMinor, currency, allowNone = true, showPayable = true }) {
  const t = useT();
  const set = (patch) => onChange({ ...split, ...patch });
  const shares = computeShares(split, members, totalMinor);
  const assigned = Object.values(shares).reduce((a, b) => a + b, 0);
  const remaining = (totalMinor || 0) - assigned;
  const err = splitError(split, members, totalMinor);
  const hasBalances = showPayable && members.some((m) => typeof m.balance === "number");

  const splitRemainder = () => {
    // Give the unassigned amount to members whose amount is still blank.
    const blanks = members.filter((m) => !String(split.shares[m._id] ?? "").trim());
    const targets = blanks.length ? blanks : members;
    if (!targets.length || remaining <= 0) return;
    const parts = allocate(remaining, targets.map(() => 1));
    const next = { ...split.shares };
    targets.forEach((m, i) => (next[m._id] = minorToInput((parseMinor(next[m._id] || "0") || 0) + parts[i])));
    set({ shares: next });
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <Segmented
        label={t("split.how")}
        value={split.mode}
        onChange={(mode) => set({ mode })}
        items={[
          { value: "equal", label: t("expenses.splitMode.equal"), icon: Users },
          { value: "custom", label: t("expenses.splitMode.custom"), icon: SlidersHorizontal },
          ...(allowNone ? [{ value: "none", label: t("split.nobody"), icon: Landmark }] : []),
        ]}
      />

      {split.mode === "equal" && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row wrap" style={{ gap: 16 }}>
            <label className="checkbox"><input type="radio" name="split-who" checked={split.allMembers} onChange={() => set({ allMembers: true })} /> {t("split.everyone")}</label>
            <label className="checkbox"><input type="radio" name="split-who" checked={!split.allMembers} onChange={() => set({ allMembers: false })} /> {t("split.some")}</label>
          </div>
          {split.allMembers && <p className="hint">{t("split.everyoneHint")}</p>}
        </div>
      )}

      {split.mode === "none" && <p className="hint">{t("split.noneHint")}</p>}

      {split.mode !== "none" && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.member")}</th>
                <th className="r" style={{ width: 150 }}>{split.mode === "custom" ? t("split.pays", { currency }) : t("split.share")}</th>
                {hasBalances && <th className="r hide-sm">{t("account.balanceNow")}</th>}
                {hasBalances && <th className="r">{t("split.willPay")}</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const included = split.mode === "custom" || split.allMembers || split.memberships.includes(m._id);
                const share = shares[m._id] || 0;
                const after = typeof m.balance === "number" ? m.balance - share : null;
                return (
                  <tr key={m._id} style={!included ? { opacity: 0.55 } : undefined}>
                    <td>
                      <label className="row" style={{ cursor: split.mode === "equal" && !split.allMembers ? "pointer" : "default" }}>
                        {split.mode === "equal" && !split.allMembers && (
                          <input type="checkbox" style={{ accentColor: "var(--accent)" }} checked={split.memberships.includes(m._id)}
                            onChange={(e) => set({ memberships: e.target.checked ? [...split.memberships, m._id] : split.memberships.filter((x) => x !== m._id) })}
                            aria-label={t("split.include", { name: m.user.name })} />
                        )}
                        <Avatar user={m.user} size={24} />
                        <span className="text-sm truncate">{m.user.name}</span>
                      </label>
                    </td>
                    <td className="r">
                      {split.mode === "custom" ? (
                        <Input inputMode="decimal" placeholder="0" value={split.shares[m._id] ?? ""} style={{ textAlign: "right", height: 32 }}
                          onChange={(e) => set({ shares: { ...split.shares, [m._id]: e.target.value } })} aria-label={t("split.memberPays", { name: m.user.name })} />
                      ) : included && totalMinor ? (
                        <span className="num strong">{money(share, currency)}</span>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>
                    {hasBalances && <td className={`r num hide-sm ${m.balance < 0 ? "neg" : m.balance > 0 ? "pos" : "muted"}`}>{money(m.balance, currency, { sign: true })}</td>}
                    {hasBalances && (
                      <td className="r">
                        {after === null ? <span className="subtle">—</span> : <span className={`num strong ${after < 0 ? "" : "pos"}`}>{money(Math.max(0, -after), currency)}</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="card-foot row between wrap" style={{ gap: 8 }}>
            {split.mode === "custom" ? (
              <>
                <span className={`text-sm ${err ? "neg" : "pos"}`}>
                  {err === "remaining" ? t("split.left", { amount: money(remaining, currency) }) : err === "over" ? t("split.over", { amount: money(-remaining, currency) }) : err || t("split.exact")}
                </span>
                {remaining > 0 && <button type="button" className="btn btn-sm btn-secondary" onClick={splitRemainder}><Wand2 size={14} /> {t("split.rest")}</button>}
              </>
            ) : (
              <span className="text-sm muted">
                {err || (totalMinor ? <>{t("split.paying", { count: Object.keys(shares).length })} · <UserCheck size={13} style={{ verticalAlign: -2 }} /> {t("split.rounded", { amount: money(totalMinor, currency) })}</> : t("split.enterAmount"))}
              </span>
            )}
            {hasBalances && <Badge style={{ height: "auto", whiteSpace: "normal" }}>{t("split.formula")}</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert split state to the API's allocation payload. */
export function splitToAllocation(split, members) {
  return {
    mode: split.mode,
    allMembers: split.allMembers,
    memberships: split.allMembers ? [] : split.memberships,
    shares: split.mode === "custom" ? members.map((m) => ({ membershipId: m._id, amount: String(split.shares[m._id] || "0").trim() || "0" })) : [],
  };
}

/** Build split state from a saved allocation. */
export function allocationToSplit(a) {
  return {
    mode: a.mode,
    allMembers: a.allMembers !== false && !(a.memberships || []).length,
    memberships: (a.memberships || []).map(String),
    shares: Object.fromEntries((a.shares || []).map((s) => [String(s.membership), minorToInput(s.amount)])),
  };
}

