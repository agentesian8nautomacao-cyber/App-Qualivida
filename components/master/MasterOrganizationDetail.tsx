import React, { useEffect, useState } from 'react';
import {
  blockMasterOrganization,
  createMasterSite,
  getMasterOrganization,
  unblockMasterOrganization,
  updateMasterOrganization,
  updateMasterSite,
  type MasterAuditEvent,
  type MasterOrganization,
  type MasterSite
} from '../../services/masterApi';
import MasterConfirmModal from './MasterConfirmModal';
import MasterStatusBadge from './MasterStatusBadge';

type Props = {
  id: string;
  accessToken: string;
  onUnauthorized: () => void;
  onForbidden: (message: string) => void;
};

type Tab = 'overview' | 'sites' | 'access' | 'audit';

export default function MasterOrganizationDetail({
  id,
  accessToken,
  onUnauthorized,
  onForbidden
}: Props) {
  const [org, setOrg] = useState<MasterOrganization | null>(null);
  const [sites, setSites] = useState<MasterSite[]>([]);
  const [audit, setAudit] = useState<MasterAuditEvent[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteTrade, setSiteTrade] = useState('');
  const [siteCnpj, setSiteCnpj] = useState('');
  const [siteCity, setSiteCity] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [immediate, setImmediate] = useState(true);
  const [scheduled, setScheduled] = useState('');

  const fail = (status: number, err: string) => {
    if (status === 401) onUnauthorized();
    else if (status === 403) onForbidden(err);
    else setError(err);
  };

  const reload = () =>
    getMasterOrganization(accessToken, id).then((res) => {
      if (!res.ok) {
        fail(res.error.status, res.error.error);
        return;
      }
      setOrg(res.data.organization);
      setSites(res.data.sites);
      setAudit(res.data.audit || []);
      setName(res.data.organization.name);
    });

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!org || saving) return;
    setSaving(true);
    const res = await updateMasterOrganization(accessToken, id, { name });
    setSaving(false);
    if (!res.ok) return fail(res.error.status, res.error.error);
    setOrg(res.data.organization);
    setMessage('Organização atualizada.');
  };

  const addSite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!siteName.trim()) return;
    const res = await createMasterSite(accessToken, id, {
      name: siteName.trim(),
      profile: {
        trade_name: siteTrade,
        cnpj: siteCnpj,
        city: siteCity,
        notes: siteNotes
      }
    });
    if (!res.ok) return fail(res.error.status, res.error.error);
    setSiteName('');
    setSiteTrade('');
    setSiteCnpj('');
    setSiteCity('');
    setSiteNotes('');
    setMessage('Site cadastrado.');
    void reload();
  };

  const toggleSite = async (site: MasterSite) => {
    const next = site.status === 'active' ? 'suspended' : 'active';
    const res = await updateMasterSite(accessToken, site.id, { status: next });
    if (!res.ok) return fail(res.error.status, res.error.error);
    void reload();
  };

  const confirmBlock = async () => {
    setSaving(true);
    const res = await blockMasterOrganization(accessToken, id, {
      reason,
      immediate,
      scheduled_at: immediate ? undefined : scheduled
    });
    setSaving(false);
    if (!res.ok) return fail(res.error.status, res.error.error);
    setBlockOpen(false);
    setReason('');
    setMessage(immediate ? 'Operação bloqueada.' : 'Bloqueio programado.');
    void reload();
  };

  const confirmUnblock = async () => {
    setSaving(true);
    const res = await unblockMasterOrganization(accessToken, id, reason || 'Desbloqueio manual');
    setSaving(false);
    if (!res.ok) return fail(res.error.status, res.error.error);
    setUnblockOpen(false);
    setReason('');
    setMessage('Operação desbloqueada.');
    void reload();
  };

  if (error) return <p className="text-red-300">{error}</p>;
  if (!org) return <p className="text-slate-400">Carregando organização…</p>;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'sites', label: 'Sites' },
    { id: 'access', label: 'Controle operacional' },
    { id: 'audit', label: 'Auditoria' }
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Organização</p>
        <h2 className="text-2xl font-black">{org.name}</h2>
        <p className="text-sm text-slate-400">
          CNPJ: {String(org.profile?.cnpj || '—')} · <MasterStatusBadge status={org.status} scheduled={org.scheduled_block_at} />
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide border ${
              tab === t.id ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200' : 'border-white/10 text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}

      {tab === 'overview' && (
        <form onSubmit={save} className="rounded-2xl border border-white/10 bg-[#0b1930] p-5 space-y-3 max-w-xl">
          <label className="block text-xs font-bold uppercase text-slate-400">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">
            Contrato: {org.contract_starts_at || '—'} → {org.contract_ends_at || 'aberto'}
          </p>
          <button type="submit" disabled={saving} className="rounded-xl bg-cyan-500 text-slate-950 font-black px-4 py-2">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      )}

      {tab === 'sites' && (
        <section className="space-y-4">
          <form onSubmit={addSite} className="space-y-2 rounded-2xl border border-white/10 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Nome do condomínio/site"
                className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
                required
              />
              <input
                value={siteTrade}
                onChange={(e) => setSiteTrade(e.target.value)}
                placeholder="Nome fantasia"
                className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
              />
              <input
                value={siteCnpj}
                onChange={(e) => setSiteCnpj(e.target.value)}
                placeholder="CNPJ (se aplicável)"
                className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
              />
              <input
                value={siteCity}
                onChange={(e) => setSiteCity(e.target.value)}
                placeholder="Cidade"
                className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={siteNotes}
              onChange={(e) => setSiteNotes(e.target.value)}
              placeholder="Observações"
              className="w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
              rows={2}
            />
            <button type="submit" className="rounded-xl bg-cyan-500 text-slate-950 font-black px-4 py-2">
              + Cadastrar site
            </button>
          </form>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
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
                      <td className="px-4 py-3">
                        <MasterStatusBadge status={site.status} />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" className="text-xs font-bold text-cyan-300" onClick={() => void toggleSite(site)}>
                          {site.status === 'active' ? 'Bloquear site' : 'Ativar site'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'access' && (
        <section className="rounded-2xl border border-white/10 bg-[#0b1930] p-5 space-y-4 max-w-xl">
          <h3 className="font-black">Controle de Acesso Operacional</h3>
          <p className="text-sm text-slate-400">
            O SentinelaAUT não processa pagamento. O bloqueio é manual ou pela data configurada pelo Master.
          </p>
          <p className="text-sm">
            Status atual: <MasterStatusBadge status={org.status} scheduled={org.scheduled_block_at} />
          </p>
          {org.block_reason && <p className="text-sm text-slate-300">Motivo: {org.block_reason}</p>}
          {org.blocked_at && (
            <p className="text-xs text-slate-500">Bloqueado em {new Date(org.blocked_at).toLocaleString('pt-BR')}</p>
          )}
          {org.scheduled_block_at && (
            <p className="text-xs text-amber-200">Bloqueio programado: {org.scheduled_block_at}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setBlockOpen(true)} className="rounded-xl bg-red-500/80 text-white font-black px-4 py-2">
              Bloquear operação
            </button>
            <button type="button" onClick={() => setUnblockOpen(true)} className="rounded-xl bg-emerald-500 text-slate-950 font-black px-4 py-2">
              Desbloquear operação
            </button>
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Contexto</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={3}>
                    Sem eventos de auditoria visíveis.
                  </td>
                </tr>
              ) : (
                audit.map((ev, i) => (
                  <tr key={`${ev.action}-${i}`} className="border-t border-white/5">
                    <td className="px-4 py-3 font-semibold">{ev.action}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {ev.occurred_at ? new Date(ev.occurred_at).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {ev.metadata && typeof ev.metadata.reason === 'string' ? ev.metadata.reason : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {blockOpen && (
        <MasterConfirmModal
          title="Bloquear operação desta organização?"
          confirmLabel="Confirmar bloqueio"
          busy={saving}
          onClose={() => setBlockOpen(false)}
          onConfirm={() => void confirmBlock()}
        >
          <label className="block text-xs font-bold uppercase text-slate-400">
            Motivo
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm min-h-[80px]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
            Bloqueio imediato
          </label>
          {!immediate && (
            <label className="block text-xs font-bold uppercase text-slate-400">
              Data/hora programada
              <input
                type="datetime-local"
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm"
              />
            </label>
          )}
        </MasterConfirmModal>
      )}

      {unblockOpen && (
        <MasterConfirmModal
          title="Desbloquear operação desta organização?"
          confirmLabel="Confirmar desbloqueio"
          busy={saving}
          onClose={() => setUnblockOpen(false)}
          onConfirm={() => void confirmUnblock()}
        >
          <label className="block text-xs font-bold uppercase text-slate-400">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm min-h-[80px]"
            />
          </label>
        </MasterConfirmModal>
      )}
    </div>
  );
}
