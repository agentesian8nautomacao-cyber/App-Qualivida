import React, { useEffect, useState } from 'react';
import {
  blockMasterOrganization,
  createMasterSite,
  getMasterOrganization,
  regularizeMasterOrganization,
  registerMasterDelay,
  setMasterAutoBlock,
  startMasterGrace,
  suspendMasterContract,
  terminateMasterContract,
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

type Tab = 'overview' | 'subscription' | 'sites' | 'access' | 'audit';
type ModalKind = 'delay' | 'grace' | 'block' | 'unblock' | 'regularize' | 'suspend' | 'terminate' | null;

function fmt(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('pt-BR');
}

function daysLeft(v?: string | null) {
  if (!v) return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

export default function MasterOrganizationDetail({
  id,
  accessToken,
  onUnauthorized,
  onForbidden
}: Props) {
  const [org, setOrg] = useState<MasterOrganization | null>(null);
  const [sites, setSites] = useState<MasterSite[]>([]);
  const [audit, setAudit] = useState<MasterAuditEvent[]>([]);
  const [tab, setTab] = useState<Tab>('subscription');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [renewal, setRenewal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteTrade, setSiteTrade] = useState('');
  const [siteCnpj, setSiteCnpj] = useState('');
  const [siteCity, setSiteCity] = useState('');
  const [siteNotes, setSiteNotes] = useState('');
  const [modal, setModal] = useState<ModalKind>(null);
  const [reason, setReason] = useState('');
  const [immediate, setImmediate] = useState(true);
  const [scheduled, setScheduled] = useState('');
  const [graceDays, setGraceDays] = useState('10');
  const [graceEnd, setGraceEnd] = useState('');
  const [reference, setReference] = useState('');

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
      const next = res.data.organization;
      setOrg(next);
      setSites(res.data.sites);
      setAudit(res.data.audit || []);
      setName(next.name);
      setNotes(next.administrative_notes || String(next.profile?.administrative_notes || next.profile?.notes || ''));
      setPeriodStart(next.current_period_start || next.contract_starts_at || '');
      setPeriodEnd(next.current_period_end || next.contract_ends_at || '');
      setRenewal(next.renewal_at || '');
    });

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  const sub = org?.subscription_status || String(org?.profile?.subscription_status || 'active');
  const blocked = org?.status === 'suspended';
  const scheduledOp = Boolean(org?.scheduled_block_at) && !blocked;
  const canRegularize = sub === 'overdue' || sub === 'grace';
  const terminated = sub === 'terminated' || sub === 'cancelled';
  const graceActive =
    Boolean(org?.grace_ends_at) && Date.parse(String(org?.grace_ends_at)) >= Date.now();

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: { status: number; error: string } }>, okMsg: string) => {
    setSaving(true);
    const res = await fn();
    setSaving(false);
    if (!res.ok) return fail(res.error.status, res.error.error);
    setModal(null);
    setReason('');
    setMessage(okMsg);
    void reload();
  };

  const confirmModal = async () => {
    if (!org) return;
    if (modal === 'delay') {
      return run(
        () => registerMasterDelay(accessToken, id, { reason, reference, identified_at: new Date().toISOString() }),
        'Atraso registrado. A operação não foi bloqueada automaticamente.'
      );
    }
    if (modal === 'grace') {
      return run(
        () =>
          startMasterGrace(accessToken, id, {
            grace_days: Number(graceDays) || undefined,
            grace_ends_at: graceEnd || undefined,
            reason
          }),
        'Período de tolerância iniciado.'
      );
    }
    if (modal === 'block') {
      return run(
        () =>
          blockMasterOrganization(accessToken, id, {
            reason,
            immediate,
            scheduled_at: immediate ? undefined : scheduled
          }),
        immediate ? 'Operação bloqueada.' : 'Bloqueio programado.'
      );
    }
    if (modal === 'unblock') {
      return run(() => unblockMasterOrganization(accessToken, id, reason), 'Operação desbloqueada. A situação da assinatura não foi alterada.');
    }
    if (modal === 'regularize') {
      return run(
        () => regularizeMasterOrganization(accessToken, id, { reason, regularized_at: new Date().toISOString() }),
        'Situação marcada como regularizada. O desbloqueio operacional é uma ação separada.'
      );
    }
    if (modal === 'suspend') {
      return run(() => suspendMasterContract(accessToken, id, reason), 'Contrato suspenso.');
    }
    if (modal === 'terminate') {
      return run(() => terminateMasterContract(accessToken, id, reason), 'Contrato encerrado.');
    }
  };

  const saveOverview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!org || saving) return;
    setSaving(true);
    const res = await updateMasterOrganization(accessToken, id, {
      name,
      administrative_notes: notes,
      current_period_start: periodStart || undefined,
      current_period_end: periodEnd || undefined,
      renewal_at: renewal || undefined,
      contract_starts_at: periodStart || undefined,
      contract_ends_at: periodEnd || undefined
    });
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
      profile: { trade_name: siteTrade, cnpj: siteCnpj, city: siteCity, notes: siteNotes }
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

  if (error) return <p className="text-red-300">{error}</p>;
  if (!org) return <p className="text-slate-400">Carregando organização…</p>;

  const remaining = daysLeft(org.grace_ends_at || org.current_period_end || org.contract_ends_at);
  const actionBtn = (label: string, onClick: () => void, disabled?: boolean, tone: 'cyan' | 'red' | 'green' | 'amber' = 'cyan') => (
    <button
      type="button"
      disabled={disabled || terminated && label !== 'Visualizar'}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-black disabled:opacity-40 ${
        tone === 'red'
          ? 'bg-red-500/80 text-white'
          : tone === 'green'
            ? 'bg-emerald-500 text-slate-950'
            : tone === 'amber'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Organização</p>
        <h2 className="text-2xl font-black">{org.name}</h2>
        <p className="text-sm text-slate-400 flex flex-wrap items-center gap-2 mt-1">
          CNPJ: {String(org.profile?.cnpj || '—')}
          <MasterStatusBadge kind="subscription" status={sub} graceActive={graceActive} />
          <MasterStatusBadge status={org.status} scheduled={org.scheduled_block_at} />
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {actionBtn('Registrar atraso', () => setModal('delay'), terminated)}
        {actionBtn('Iniciar tolerância', () => setModal('grace'), terminated)}
        {actionBtn('Programar bloqueio', () => { setImmediate(false); setModal('block'); }, blocked || terminated, 'amber')}
        {blocked
          ? actionBtn('Desbloquear', () => setModal('unblock'), false, 'green')
          : actionBtn('Bloquear agora', () => { setImmediate(true); setModal('block'); }, terminated, 'red')}
        {actionBtn('Marcar regularizada', () => setModal('regularize'), !canRegularize || terminated, 'green')}
        {actionBtn('Suspender contrato', () => setModal('suspend'), terminated)}
        {actionBtn('Encerrar contrato', () => setModal('terminate'), terminated, 'red')}
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['subscription', 'Situação da assinatura'],
            ['overview', 'Cadastro / contrato'],
            ['sites', 'Sites'],
            ['access', 'Controle operacional'],
            ['audit', 'Histórico']
          ] as Array<[Tab, string]>
        ).map(([tid, label]) => (
          <button
            key={tid}
            type="button"
            onClick={() => setTab(tid)}
            className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide border ${
              tab === tid ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200' : 'border-white/10 text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'subscription' && (
        <section className="rounded-2xl border border-white/10 bg-[#0b1930] p-5 space-y-3 max-w-2xl">
          <h3 className="font-black">Situação da assinatura</h3>
          <p className="text-xs text-slate-500">Status administrativo. Não representa pagamento nem valor.</p>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Status da assinatura</dt>
              <dd>
                <MasterStatusBadge kind="subscription" status={sub} graceActive={graceActive} />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Início da assinatura</dt>
              <dd>{org.contract_starts_at || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Início do período atual</dt>
              <dd>{org.current_period_start || org.contract_starts_at || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Término do período atual</dt>
              <dd>{org.current_period_end || org.contract_ends_at || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Data de renovação</dt>
              <dd>{org.renewal_at || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Tolerância</dt>
              <dd>
                {org.grace_ends_at ? `Tolerância até ${org.grace_ends_at}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-slate-500">Dias restantes</dt>
              <dd>{remaining == null ? '—' : remaining}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-slate-500">Observações administrativas</dt>
              <dd>{org.administrative_notes || String(org.profile?.administrative_notes || '—')}</dd>
            </div>
          </dl>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(org.auto_block_enabled || org.profile?.auto_block_enabled)}
              onChange={(e) => void setMasterAutoBlock(accessToken, id, e.target.checked).then(() => reload())}
            />
            Bloqueio automático após término da tolerância
          </label>
        </section>
      )}

      {tab === 'overview' && (
        <form onSubmit={saveOverview} className="rounded-2xl border border-white/10 bg-[#0b1930] p-5 space-y-3 max-w-xl">
          <label className="block text-xs font-bold uppercase text-slate-400">
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-400">
            Início do período atual
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-400">
            Término do período atual
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-400">
            Data de renovação
            <input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-400">
            Observações administrativas
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm min-h-[80px]" />
          </label>
          <button type="submit" disabled={saving} className="rounded-xl bg-cyan-500 text-slate-950 font-black px-4 py-2">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      )}

      {tab === 'sites' && (
        <section className="space-y-4">
          <form onSubmit={addSite} className="space-y-2 rounded-2xl border border-white/10 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Nome do condomínio/site" className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" required />
              <input value={siteTrade} onChange={(e) => setSiteTrade(e.target.value)} placeholder="Nome fantasia" className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
              <input value={siteCnpj} onChange={(e) => setSiteCnpj(e.target.value)} placeholder="CNPJ (se aplicável)" className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
              <input value={siteCity} onChange={(e) => setSiteCity(e.target.value)} placeholder="Cidade" className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
            </div>
            <textarea value={siteNotes} onChange={(e) => setSiteNotes(e.target.value)} placeholder="Observações" className="w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" rows={2} />
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
                        <button
                          type="button"
                          className="text-xs font-bold text-cyan-300"
                          onClick={() =>
                            void updateMasterSite(accessToken, site.id, {
                              status: site.status === 'active' ? 'suspended' : 'active'
                            }).then(() => reload())
                          }
                        >
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
            Atraso administrativo e bloqueio operacional são independentes. O SentinelaAUT não processa pagamento.
          </p>
          <p className="text-sm">
            Assinatura: <MasterStatusBadge kind="subscription" status={sub} graceActive={graceActive} />
          </p>
          <p className="text-sm">
            Operação: <MasterStatusBadge status={org.status} scheduled={org.scheduled_block_at} />
          </p>
          {org.block_reason && <p className="text-sm text-slate-300">Motivo: {org.block_reason}</p>}
          {org.blocked_at && <p className="text-xs text-slate-500">Bloqueado em {fmt(org.blocked_at)}</p>}
          {scheduledOp && <p className="text-xs text-amber-200">Bloqueio programado: {org.scheduled_block_at}</p>}
        </section>
      )}

      {tab === 'audit' && (
        <section className="rounded-2xl border border-white/10 overflow-hidden">
          <h3 className="px-4 py-3 font-black text-sm">Histórico administrativo</h3>
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Origem / contexto</th>
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
                    <td className="px-4 py-3 text-slate-400 text-xs">{ev.occurred_at ? fmt(ev.occurred_at) : '—'}</td>
                    <td className="px-4 py-3 font-semibold">{ev.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {String(ev.metadata?.source || ev.metadata?.reason || ev.actor_user_id || '—')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {modal && (
        <MasterConfirmModal
          title={
            modal === 'delay'
              ? 'Registrar atraso administrativo?'
              : modal === 'grace'
                ? 'Iniciar período de tolerância?'
                : modal === 'block'
                  ? 'Bloquear operação desta organização?'
                  : modal === 'unblock'
                    ? 'Desbloquear operação desta organização?'
                    : modal === 'regularize'
                      ? 'Marcar situação como regularizada?'
                      : modal === 'suspend'
                        ? 'Suspender contrato?'
                        : 'Encerrar contrato?'
          }
          confirmLabel="Confirmar"
          busy={saving}
          onClose={() => setModal(null)}
          onConfirm={() => void confirmModal()}
        >
          {modal === 'delay' && (
            <label className="block text-xs font-bold uppercase text-slate-400">
              Referência / período
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
            </label>
          )}
          {modal === 'grace' && (
            <>
              <label className="block text-xs font-bold uppercase text-slate-400">
                Dias de tolerância
                <input value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-bold uppercase text-slate-400">
                Ou data final
                <input type="date" value={graceEnd} onChange={(e) => setGraceEnd(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
              </label>
            </>
          )}
          {modal === 'block' && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
                Bloqueio imediato
              </label>
              {!immediate && (
                <label className="block text-xs font-bold uppercase text-slate-400">
                  Data/hora programada
                  <input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm" />
                </label>
              )}
            </>
          )}
          <label className="block text-xs font-bold uppercase text-slate-400">
            Motivo / observação
            <textarea required value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm min-h-[80px]" />
          </label>
        </MasterConfirmModal>
      )}
    </div>
  );
}
