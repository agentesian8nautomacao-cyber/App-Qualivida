import React, { useEffect, useState } from 'react';
import {
  listMasterOrganizations,
  type MasterOrganization
} from '../../services/masterApi';

type Props = {
  accessToken: string;
  onOpen: (id: string) => void;
  onUnauthorized: () => void;
  onForbidden: (message: string) => void;
};

export default function MasterOrganizations({
  accessToken,
  onOpen,
  onUnauthorized,
  onForbidden
}: Props) {
  const [rows, setRows] = useState<MasterOrganization[]>([]);
  const [meta, setMeta] = useState({ subscription: 'Não configurado', plan: 'Não configurado' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMasterOrganizations(accessToken).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        if (res.error.status === 401) onUnauthorized();
        else if (res.error.status === 403) onForbidden(res.error.error);
        else setError(res.error.error);
        return;
      }
      setRows(res.data.organizations);
      setMeta({ subscription: res.data.subscription, plan: res.data.plan });
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, onForbidden, onUnauthorized]);

  if (error) return <p className="text-red-300">{error}</p>;

  return (
    <div>
      <h2 className="text-2xl font-black mb-1">Organizações</h2>
      <p className="text-sm text-slate-400 mb-6">
        Plano: {meta.plan} · Assinatura: {meta.subscription}
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sites</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  Nenhuma organização visível.
                </td>
              </tr>
            ) : (
              rows.map((org) => (
                <tr key={org.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-semibold text-cyan-200 hover:underline"
                      onClick={() => onOpen(org.id)}
                    >
                      {org.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{org.slug}</td>
                  <td className="px-4 py-3">{org.status}</td>
                  <td className="px-4 py-3">{org.sites_count ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
