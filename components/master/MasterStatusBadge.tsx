import React from 'react';

export function operationalLabel(status: string, scheduled?: string | null): string {
  if (scheduled && status === 'active') return 'PROGRAMADA';
  if (status === 'active') return 'ATIVA';
  if (status === 'suspended') return 'BLOQUEADA';
  return 'SUSPENSA';
}

export function subscriptionLabel(status?: string | null, graceActive?: boolean): string {
  if (graceActive) return 'EM TOLERÂNCIA';
  const s = String(status || 'active').toLowerCase();
  if (s === 'overdue') return 'EM ATRASO';
  if (s === 'grace') return 'EM TOLERÂNCIA';
  if (s === 'suspended') return 'SUSPENSA';
  if (s === 'terminated') return 'ENCERRADA';
  if (s === 'cancelled') return 'CANCELADA';
  return 'ATIVA';
}

function badgeClass(label: string): string {
  if (label === 'ATIVA') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
  if (label === 'BLOQUEADA' || label === 'EM ATRASO' || label === 'ENCERRADA' || label === 'CANCELADA') {
    return 'bg-red-500/15 text-red-300 border-red-400/30';
  }
  if (label === 'PROGRAMADA' || label === 'EM TOLERÂNCIA') return 'bg-amber-500/15 text-amber-200 border-amber-400/30';
  return 'bg-slate-500/15 text-slate-300 border-white/15';
}

export default function MasterStatusBadge({
  status,
  scheduled,
  kind = 'operation',
  graceActive
}: {
  status: string;
  scheduled?: string | null;
  kind?: 'operation' | 'subscription';
  graceActive?: boolean;
}) {
  const label = kind === 'subscription' ? subscriptionLabel(status, graceActive) : operationalLabel(status, scheduled);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${badgeClass(label)}`}>
      {label}
    </span>
  );
}
