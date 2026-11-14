import { useEffect, useState } from "react";
import { onlineManager, useMutationState } from "@tanstack/react-query";
import { WifiOff, Loader2 } from "lucide-react";
import { onSlowRequests } from "../lib/api";
import { useT } from "../i18n/I18nProvider";

function useOnline() {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/**
 * A thin bar under the top bar:
 *  - offline: says so, and how many changes are waiting (they're sent automatically on reconnect)
 *  - slow: a gentle "still working" once a request passes a few seconds (e.g. the server waking up)
 */
export default function NetworkStatus() {
  const online = useOnline();
  const t = useT();
  const [slow, setSlow] = useState(0);
  useEffect(() => onSlowRequests(setSlow), []);
  const waiting = useMutationState({ filters: { predicate: (m) => m.state.isPaused } }).length;

  if (!online) {
    return (
      <div className="netbar netbar-offline" role="status" aria-live="polite">
        <WifiOff size={14} aria-hidden />
        <span>
          {t("network.offline")}{" "}
          {waiting > 0 ? t("network.waiting", { count: waiting }) : t("network.keepBrowsing")}
        </span>
      </div>
    );
  }
  if (slow > 0) {
    return (
      <div className="netbar" role="status" aria-live="polite">
        <Loader2 size={14} className="netbar-spin" aria-hidden />
        <span>{t("network.slow")}</span>
      </div>
    );
  }
  return null;
}
