import React from 'react';
import { ShieldOff } from 'lucide-react';

type Props = {
  title?: string;
  message: string;
  onBackToLogin: () => void;
};

export default function MasterDenied({
  title = 'Acesso Master negado',
  message,
  onBackToLogin
}: Props) {
  return (
    <div className="min-h-screen bg-[var(--sentinela-bg,#06101f)] text-[var(--sentinela-text,#e2e8f0)] flex items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-red-400/20 bg-[var(--sentinela-surface,#0b1930)] p-8 text-center">
        <ShieldOff className="w-10 h-10 text-red-300 mx-auto mb-4" />
        <h1 className="text-xl font-black mb-2">{title}</h1>
        <p className="text-sm text-[var(--sentinela-text-muted,#94a3b8)] mb-6">{message}</p>
        <button
          type="button"
          onClick={onBackToLogin}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
        >
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
