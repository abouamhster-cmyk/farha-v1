import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function ConfirmModal({ open, onConfirm, onCancel, title, children, confirmLabel = "Confirmer", cancelLabel = "Annuler", confirmColor = "bg-henne hover:bg-henne-light", primaryAction = null }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fadeIn"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-scaleIn">
        <button onClick={onCancel} className="absolute top-4 right-4 text-muted hover:text-ink transition-colors">
          <X size={20} />
        </button>

        {title && <h3 className="font-display text-lg font-bold mb-3">{title}</h3>}
        <div className="text-sm text-muted leading-relaxed mb-6">{children}</div>

        {/* Action recommandée mise en avant (optionnelle) */}
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className={`w-full py-3 rounded-xl text-white text-sm font-bold transition-colors mb-3 ${primaryAction.color || "bg-emerald hover:bg-emerald-light"}`}
          >
            {primaryAction.label}
          </button>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-line text-sm font-bold text-muted hover:bg-cream transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
