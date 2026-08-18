import React, { useEffect, useState } from 'react';
import { getMasterDashboard, type MasterDashboard as Metrics } from '../../services/masterApi';
import MasterStatusBadge from './MasterStatusBadge';

type Props = {
  accessToken: string;
  onOpenOrg: (id: string) => void;
  onUnauthorized: () => void;
  onForbidden: (message: string) => void;
};

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1930] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

export default function MasterDashboard({ accessToken, onOpenOrg, onUnauthorized, onForbidden }: Props) {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMasterDashboard(accessToken).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        if (res.error.status === 401) onUnauthorized();
        else if (res.error.status === 403) onForbidden(res.error.error);
        else setError(res.error.error);
        return;
      }
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onForbidden, onUnauthorized]);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!data) return <p className="text-slate-400">Carregando visão geral…</p>;

  const rows = data.organizations || [];

  return (
    <div>
      <h2 className="text-2xl font-black mb-1">SentinelaAUT Master</h2>
      <p className="text-sm text-slate-400 mb-6">Central de Administração da Plataforma — sem módulo financeiro.</p>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <Card label="Organizações" value={data.metrics.organizations_total} />
        <Card label="Sites ativos" value={data.metrics.sites_operational} />
        <Card label="Sites bloqueados" value={data.metrics.sites_blocked ?? data.metrics.organizations_suspended} />
        <Card label="Operações ativas" value={data.metrics.operations_active ?? data.metrics.sites_operational} />
        <Card label="Bloqueios programados" value={data.metrics.scheduled_blocks ?? 0} />
      </div>
      <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Organizações</h3>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-white/5 text-left text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Organização</th>
              <th className="px-4 py-3">Sites</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Bloqueio</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={5}>
                  Nenhuma organização cadastrada.
                </td>
              </tr>
            ) : (
              rows.map((org) => (
                <tr key={org.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold">{org.name}</td>
                  <td className="px-4 py-3">{org.sites_count ?? '—'}</td>
                  <td className="px-4 py-3">
                    <MasterStatusBadge status={org.status} scheduled={org.scheduled_block_at} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {org.blocked_at ? new Date(org.blocked_at).toLocaleString('pt-BR') : org.scheduled_block_at ? `Prog. ${org.scheduled_block_at}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-cyan-300 font-bold text-xs hover:underline mr-3"
                      onClick={() => onOpenOrg(org.id)}
                    >
                      Visualizar
                    </button>
                    <button
                      type="button"
                      className="text-cyan-300 font-bold text-xs hover:underline mr-3"
                      onClick={() => onOpenOrg(org.id)}
                    >
                      Editar
                    </button>
                    <button type="button" className="text-cyan-300 font-bold text-xs hover:underline" onClick={() => onOpenOrg(org.id)}>
                      Gerenciar acesso
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
