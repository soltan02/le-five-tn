import { createContext, useContext, useState, useCallback, useEffect } from "react";
import "./ui.css";

export function Button({ variant = "primary", size, block, className = "", ...props }) {
  const cls = [
    "btn", `btn-${variant}`, size === "sm" && "btn-sm", block && "btn-block", className,
  ].filter(Boolean).join(" ");
  return <button className={cls} {...props} />;
}

export function Card({ pad = true, className = "", children, ...props }) {
  return (
    <div className={`card ${pad ? "card-pad" : ""} ${className}`} {...props}>
      {children}
    </div>
  );
}

const STATUS = {
  confirmed: ["badge-confirmed", "Confirmé"],
  pending: ["badge-pending", "En attente"],
  cancelled: ["badge-cancelled", "Annulé"],
  declined: ["badge-cancelled", "Refusé"],
  free: ["badge-free", "Libre"],
  taken: ["badge-taken", "Réservé"],
};
export function StatusBadge({ status, label }) {
  const [cls, text] = STATUS[status] || ["badge-cancelled", status];
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {label || text}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ glyph = "⚽", title, message, action }) {
  return (
    <div className="empty">
      <div className="glyph">{glyph}</div>
      <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16 }}>{title}</div>
      {message && <div style={{ marginTop: 4 }}>{message}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ---- Toast ----
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, opts = {}) => {
    setToast({ message, err: !!opts.err, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast-wrap">
          <div className={`toast ${toast.err ? "err" : ""}`}>
            <span style={{ fontSize: 16 }}>{toast.err ? "⚠️" : "✅"}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
