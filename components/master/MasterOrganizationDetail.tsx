import React, { useEffect, useState } from 'react';
import {
  getMasterOrganization,
  updateMasterOrganization,
  type MasterOrganization,
  type MasterSite
} from '../../services/masterApi';

type Props = {
  id: string;
  accessToken: string;
  onUnauthorized: () => void;
  onForbidden: (message: string) => void;
};

export default function MasterOrganizationDetail({
  id,
  accessToken,
  onUnauthorized,
  onForbidden
}: Props) {
  const [org, setOrg] = useState<MasterOrganization | null>(null);
  const [sites, setSites] = useState<MasterSite[]>([]);
  const [subscription, setSubscription] = useState('Não configurado');
  const [users, setUsers] = useState('Não configurado');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMasterOrganization(accessToken, id).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        if (res.error.status === 401) onUnauthorized();
        else if (res.error.status === 403) onForbidden(res.error.error);
        else setError(res.error.error);
        return;
      }
      setOrg(res.data.organization);
      setSites(res.data.sites);
      setSubscription(res.data.subscription);
      setUsers(res.data.users);
      setName(res.data.organization.name);
      setSlug(res.data.organization.slug);
      setStatus(res.data.organization.status);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id, onForbidden, onUnauthorized]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!org || saving) return;
    setSaving(true);
    setMessage(null);
    const res = await updateMasterOrganization(accessToken, id, { name, slug, status });
    setSaving(false);
    if (!res.ok) {
      if (res.error.status === 401) onUnauthorized();
      else if (res.error.status === 403) onForbidden(res.error.error);
      else setError(res.error.error);
      return;
    }
    setOrg(res.data.organization);
    setMessage('Organização atualizada. Ação auditada no servidor.');
  };

  if (error) return <p className="text-red-300">{error}</p>;
  if (!org) return <p className="text-slate-400">Carregando organização…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">{org.name}</h2>
        <p className="text-sm text-slate-400">{org.id}</p>
      </div>

      <form onSubmit={save} className="rounded-2xl border border-white/10 bg-[#0b1930] p-5 space-y-4 max-w-xl">
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-400">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-400">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-400">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-cyan-500 text-slate-950 font-black px-4 py-2 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {message && <p className="text-sm text-emerald-300">{message}</p>}
      </form>

      <section>
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Sites</h3>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={3}>
                    Nenhum site nesta organização.
                  </td>
                </tr>
              ) : (
                sites.map((site) => (
                  <tr key={site.id} className="border-t border-white/5">
                    <td className="px-4 py-3">{site.name}</td>
                    <td className="px-4 py-3 text-slate-400">{site.slug}</td>
                    <td className="px-4 py-3">{site.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[10px] font-black uppercase text-slate-400">Assinatura</p>
          <p className="mt-1 font-semibold">{subscription}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[10px] font-black uppercase text-slate-400">Usuários</p>
          <p className="mt-1 font-semibold">{users}</p>
        </div>
      </section>
    </div>
  );
}
