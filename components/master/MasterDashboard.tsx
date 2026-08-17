import React, { useEffect, useState } from 'react';
import { getMasterDashboard, type MasterDashboard as Metrics } from '../../services/masterApi';

type Props = {
  accessToken: string;
  onUnauthorized: () => void;
  onForbidden: (message: string) => void;
};

function Card({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1930] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-50">{value}</p>
    </div>
  );
}

export default function MasterDashboard({ accessToken, onUnauthorized, onForbidden }: Props) {
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

  if (error) {
    return <p className="text-red-300">{error}</p>;
  }
  if (!data) {
    return <p className="text-slate-400">Carregando métricas…</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-black mb-1">Dashboard</h2>
      <p className="text-sm text-slate-400 mb-6">Somente métricas existentes no schema atual.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card label="Organizações" value={data.metrics.organizations_total} />
        <Card label="Ativas" value={data.metrics.organizations_active} />
        <Card label="Suspensas" value={data.metrics.organizations_suspended} />
        <Card label="Sites operacionais" value={data.metrics.sites_operational} />
        <Card label="Assinaturas ativas" value="Não configurado" />
        <Card label="Assinaturas vencidas" value="Não configurado" />
        <Card label="Trial" value="Não configurado" />
        <Card label="MRR" value="Não configurado" />
      </div>
      <p className="mt-6 text-xs text-slate-500">Billing: {data.billing}</p>
    </div>
  );
}
