import { useEffect, useState } from "react";
import { onlineManager, useMutationState } from "@tanstack/react-query";
import { WifiOff, Loader2 } from "lucide-react";
import { onSlowRequests } from "../lib/api";

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
  const [slow, setSlow] = useState(0);
  useEffect(() => onSlowRequests(setSlow), []);
  const waiting = useMutationState({ filters: { predicate: (m) => m.state.isPaused } }).length;

  if (!online) {
    return (
      <div className="netbar netbar-offline" role="status" aria-live="polite">
        <WifiOff size={14} aria-hidden />
        <span>
          You're offline.{" "}
          {waiting > 0 ? `${waiting} change${waiting > 1 ? "s" : ""} will be sent when you reconnect.` : "You can keep browsing what's already loaded."}
        </span>
      </div>
    );
  }
  if (slow > 0) {
    return (
      <div className="netbar" role="status" aria-live="polite">
        <Loader2 size={14} className="netbar-spin" aria-hidden />
        <span>Still working… the connection is slow or the server is waking up.</span>
      </div>
    );
  }
  return null;
}
