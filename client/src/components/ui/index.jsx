import { createContext, useContext, useEffect, useId, useRef, useState, cloneElement } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Inbox, AlertTriangle } from "lucide-react";
import { assetUrl } from "../../lib/api";
import { initials, money } from "../../lib/format";

export function Button({ variant = "secondary", size, icon: Icon, iconRight: IconRight, loading, block, className = "", children, type = "button", ...props }) {
  const cls = ["btn", `btn-${variant}`, size === "sm" && "btn-sm", !children && "btn-icon", block && "btn-block", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 className="spin" /> : Icon ? <Icon aria-hidden /> : null}
      {children}
      {IconRight && !loading && <IconRight aria-hidden />}
    </button>
  );
}

// Lets an Input/Textarea/Select nested in a wrapper (e.g. an icon input-group)
// take its Field's id, so the <label> is always linked to the real control.
const FieldContext = createContext(null);

export function Field({ label, hint, error, children, className = "", optional }) {
  const autoId = useId();
  const single = children && typeof children === "object" && !Array.isArray(children);
  const id = (single && children.props.id) || autoId;
  const noteId = `${id}-note`;
  const describedBy = error || hint ? noteId : undefined;
  const isControl = single && [Input, Textarea, Select, "input", "select", "textarea"].includes(children.type);
  const child = isControl
    ? cloneElement(children, { id, "aria-invalid": error ? "true" : undefined, "aria-describedby": children.props["aria-describedby"] || describedBy })
    : children;
  return (
    <FieldContext.Provider value={isControl ? null : { id, invalid: Boolean(error), describedBy }}>
      <div className={`field ${className}`}>
        {label && (
          <label className="label" htmlFor={id}>
            {label} {optional && <span className="subtle" style={{ fontWeight: 400 }}>(optional)</span>}
          </label>
        )}
        {child}
        {error ? <span className="error-text" id={noteId}>{error}</span> : hint ? <span className="hint" id={noteId}>{hint}</span> : null}
      </div>
    </FieldContext.Provider>
  );
}

/** A control nested inside a Field wrapper picks up the Field's id (unless it has its own). */
function useFieldProps(props) {
  const ctx = useContext(FieldContext);
  if (!ctx || props.id) return props;
  return { id: ctx.id, "aria-invalid": ctx.invalid ? "true" : undefined, "aria-describedby": ctx.describedBy, ...props };
}

export function Input(props) {
  return <input className="input" {...useFieldProps(props)} />;
}
export function Textarea(props) {
  return <textarea className="textarea" {...useFieldProps(props)} />;
}
export function Select({ options = [], children, ...rest }) {
  const props = useFieldProps(rest);
  return (
    <select className="select" {...props}>
      {children}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return <button type="button" role="switch" aria-checked={Boolean(checked)} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function SettingRow({ title, description, children }) {
  return (
    <div className="setting-row">
      <div className="grow">
        <div className="strong text-sm">{title}</div>
        {description && <div className="hint">{description}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad, footer, as: Tag = "section", ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
      {footer && <div className="card-foot">{footer}</div>}
    </Tag>
  );
}

export const Badge = ({ tone, children, icon: Icon, ...p }) => (
  <span className={`badge ${tone ? `badge-${tone}` : ""}`} {...p}>
    {Icon && <Icon />}
    {children}
  </span>
);

const STATUS_TONE = { pending: "warning", approved: "success", posted: "success", active: "success", rejected: "danger", cancelled: undefined, void: "danger", open: "accent", closed: undefined, left: undefined, removed: "danger", accepted: "success", declined: undefined, revoked: "danger", expired: undefined };
export const StatusBadge = ({ status, label }) => <Badge tone={STATUS_TONE[status]}>{label || status?.replace(/_/g, " ")}</Badge>;

export function Avatar({ user, size = 32, online }) {
  const [broken, setBroken] = useState(false);
  const src = user?.avatarUrl && !broken ? assetUrl(user.avatarUrl) : null;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }} title={user?.name}>
      {src ? <img src={src} alt="" onError={() => setBroken(true)} /> : <span aria-hidden="true" className="initials" data-initials={initials(user?.name)} />}
      {online !== undefined && online && <span className="dot dot-online" />}
    </span>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size }) {
  const ref = useRef(null);
  // Keep the latest onClose without re-running the open/focus effect: callers often pass
  // a new arrow function every render, which used to yank focus back to the first field
  // on every keystroke.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => e.key === "Escape" && closeRef.current?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector("input, select, textarea, button:not([data-close])")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === "lg" ? "modal-lg" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} ref={ref}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" data-close />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Modal with a form; submit runs onSubmit. */
export function FormModal({ open, onClose, title, description, onSubmit, submitLabel = "Save", loading, children, danger, size, disabled }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size={size}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} type="submit" form="modal-form" loading={loading} disabled={disabled}>{submitLabel}</Button>
        </>
      }>
      <form id="modal-form" className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {children}
      </form>
    </Modal>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", danger, loading, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }>
      {children}
    </Modal>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact }) {
  return (
    <div className="empty" style={compact ? { padding: "28px 20px" } : undefined}>
      <div className="empty-icon"><Icon /></div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = "100%", r, style }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;

export function LoadingBlock({ rows = 4 }) {
  return (
    <div className="stack" style={{ padding: "var(--card-pad)" }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row-3" key={i}>
          <Skeleton h={32} w={32} r={999} />
          <div className="grow col" style={{ gap: 6 }}>
            <Skeleton h={12} w={`${60 - i * 7}%`} />
            <Skeleton h={10} w={`${35 + i * 5}%`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="stack-lg">
      <Skeleton h={28} w={220} />
      <div className="grid-4">{[0, 1, 2, 3].map((i) => <div className="card stat" key={i}><Skeleton h={12} w="50%" /><Skeleton h={26} w="70%" /></div>)}</div>
      <div className="card"><LoadingBlock rows={5} /></div>
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <EmptyState icon={AlertTriangle} title="Couldn't load this" description={error?.message || "Something went wrong."} action={retry && <Button onClick={retry}>Try again</Button>} />
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
          {t.icon && <t.icon size={15} />}
          {t.label}
          {t.count ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ items, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map((t) => (
        <button key={t.value} type="button" aria-pressed={value === t.value} onClick={() => onChange(t.value)}>
          {t.icon && <t.icon size={14} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className="card stat">
      <div className="stat-label">{Icon && <Icon />}{label}</div>
      <div className={`stat-value ${tone || ""}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export const Money = ({ value, currency, sign, colored, className = "" }) => (
  <span className={`num ${colored ? (value < 0 ? "neg" : value > 0 ? "pos" : "") : ""} ${className}`}>{money(value, currency, { sign })}</span>
);

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="page-head">
      <div className="col" style={{ gap: 2 }}>
        {back}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

/** Lightweight dropdown menu anchored to its trigger. */
export function Menu({ trigger, children, align = "end", width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {cloneElement(trigger, { onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <div className="menu" role="menu" style={{ top: "calc(100% + 6px)", [align === "end" ? "right" : "left"]: 0, width }} onClick={(e) => e.target.closest("[data-close-menu],.menu-item") && setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, danger, ...props }) {
  return (
    <button type="button" role="menuitem" className={`menu-item ${danger ? "danger" : ""}`} {...props}>
      {Icon && <Icon />}
      {children}
    </button>
  );
}

export function Alert({ tone = "info", icon: Icon, children, style }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "danger" ? "alert" : undefined} style={style}>
      {Icon && <Icon />}
      <div className="grow">{children}</div>
    </div>
  );
}
