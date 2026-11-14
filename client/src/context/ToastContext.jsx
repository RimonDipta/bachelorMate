/* eslint-disable react-refresh/only-export-components */
import { translate } from "../i18n";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, message, opts = {}) => {
      const id = nextId++;
      setToasts((t) => [...t.slice(-3), { id, type, message, ...opts }]);
      setTimeout(() => dismiss(id), opts.duration || (type === "error" ? 6000 : 3500));
    },
    [dismiss]
  );
  const api = useMemo(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", typeof m === "string" ? m : m?.message || translate("common.somethingWrong"), o),
      info: (m, o) => push("info", m, o),
    }),
    [push]
  );
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.type];
          return (
            <div key={t.id} className={`toast ${t.type}`} role={t.type === "error" ? "alert" : "status"}>
              <I />
              <div className="grow">
                {t.title && <div className="strong">{t.title}</div>}
                <div className={t.title ? "muted" : ""}>{t.message}</div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => dismiss(t.id)} aria-label={translate("setup.dismiss")}><X /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
