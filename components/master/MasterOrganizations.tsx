import React, { useEffect, useState } from 'react';
import {
  createMasterOrganization,
  listMasterOrganizations,
  type MasterOrganization
} from '../../services/masterApi';
import MasterStatusBadge from './MasterStatusBadge';

type Props = {
  accessToken: string;
  onOpen: (id: string) => void;
  onUnauthorized: () => void;
  onForbidden: (message: string) => void;
};

const emptyProfile = {
  legal_name: '',
  trade_name: '',
  cnpj: '',
  admin_email: '',
  phone: '',
  mobile: '',
  address: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  zip: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  internal_code: '',
  notes: ''
};

export default function MasterOrganizations({
  accessToken,
  onOpen,
  onUnauthorized,
  onForbidden
}: Props) {
  const [rows, setRows] = useState<MasterOrganization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(emptyProfile);
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');

  const reload = () => {
    listMasterOrganizations(accessToken).then((res) => {
      if (!res.ok) {
        if (res.error.status === 401) onUnauthorized();
        else if (res.error.status === 403) onForbidden(res.error.error);
        else setError(res.error.error);
        return;
      }
      setRows(res.data.organizations);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await createMasterOrganization(accessToken, {
      name: name.trim(),
      profile,
      contract_starts_at: contractStart || undefined,
      contract_ends_at: contractEnd || undefined
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error.error);
      return;
    }
    setOpenForm(false);
    setName('');
    setProfile(emptyProfile);
    onOpen(res.data.organization.id);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black">Organizações</h2>
          <p className="text-sm text-slate-400">Empresas contratantes e seus condomínios/sites.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenForm((v) => !v)}
          className="rounded-xl bg-cyan-500 text-slate-950 font-black px-4 py-2"
        >
          + Nova organização
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      {openForm && (
        <form onSubmit={create} className="mb-6 rounded-2xl border border-white/10 bg-[#0b1930] p-5 grid sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-xs font-bold uppercase text-slate-400">
            Nome da organização
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          {(
            [
              ['legal_name', 'Razão social'],
              ['trade_name', 'Nome fantasia'],
              ['cnpj', 'CNPJ'],
              ['admin_email', 'E-mail administrativo'],
              ['phone', 'Telefone'],
              ['mobile', 'Celular'],
              ['address', 'Endereço'],
              ['number', 'Número'],
              ['complement', 'Complemento'],
              ['district', 'Bairro'],
              ['city', 'Cidade'],
              ['state', 'Estado'],
              ['zip', 'CEP'],
              ['contact_name', 'Responsável'],
              ['contact_email', 'E-mail do responsável'],
              ['contact_phone', 'Telefone do responsável'],
              ['internal_code', 'Código interno']
            ] as Array<[keyof typeof emptyProfile, string]>
          ).map(([key, label]) => (
            <label key={key} className="text-xs font-bold uppercase text-slate-400">
              {label}
              <input
                value={profile[key]}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ))}
          <label className="text-xs font-bold uppercase text-slate-400">
            Início do contrato
            <input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="text-xs font-bold uppercase text-slate-400">
            Término do contrato
            <input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="sm:col-span-2 text-xs font-bold uppercase text-slate-400">
            Observações
            <textarea
              value={profile.notes}
              onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))}
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm text-slate-100 min-h-[80px]"
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-xl px-3 py-2 text-sm border border-white/10">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-xl bg-cyan-500 text-slate-950 font-black px-4 py-2 disabled:opacity-60">
              {saving ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      )}

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
                  Nenhuma organização visível. Cadastre a primeira ou aplique a migration de INSERT quando aprovada.
                </td>
              </tr>
            ) : (
              rows.map((org) => (
                <tr key={org.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold">{org.name}</td>
                  <td className="px-4 py-3">{org.sites_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <MasterStatusBadge status={org.status} scheduled={org.scheduled_block_at} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{org.block_reason || '—'}</td>
                  <td className="px-4 py-3 space-x-3">
                    <button type="button" className="text-cyan-300 font-bold text-xs" onClick={() => onOpen(org.id)}>
                      Visualizar
                    </button>
                    <button type="button" className="text-cyan-300 font-bold text-xs" onClick={() => onOpen(org.id)}>
                      Editar
                    </button>
                    <button type="button" className="text-cyan-300 font-bold text-xs" onClick={() => onOpen(org.id)}>
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
