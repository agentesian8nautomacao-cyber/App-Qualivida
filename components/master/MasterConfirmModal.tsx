import React from 'react';

type Props = {
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  children: React.ReactNode;
};

export default function MasterConfirmModal({
  title,
  confirmLabel,
  onClose,
  onConfirm,
  busy,
  children
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1930] p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black mb-3">{title}</h3>
        <div className="space-y-3 text-sm">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold border border-white/10">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl px-3 py-2 text-sm font-black bg-cyan-500 text-slate-950 disabled:opacity-60"
          >
            {busy ? 'Confirmando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
