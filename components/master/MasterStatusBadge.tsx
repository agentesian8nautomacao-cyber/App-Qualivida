import React from 'react';

export function operationalLabel(status: string, scheduled?: string | null): string {
  if (scheduled && status === 'active') return 'PROGRAMADA';
  if (status === 'active') return 'ATIVA';
  if (status === 'suspended') return 'BLOQUEADA';
  return 'SUSPENSA';
}

export default function MasterStatusBadge({
  status,
  scheduled
}: {
  status: string;
  scheduled?: string | null;
}) {
  const label = operationalLabel(status, scheduled);
  const cls =
    label === 'ATIVA'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
      : label === 'BLOQUEADA'
        ? 'bg-red-500/15 text-red-300 border-red-400/30'
        : label === 'PROGRAMADA'
          ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
          : 'bg-slate-500/15 text-slate-300 border-white/15';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
