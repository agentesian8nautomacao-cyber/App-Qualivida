import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { BRANDING } from '../../config/branding';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface PresentationViewProps {
  /** Chamado quando o usuário decide ir para o login. */
  onEnterSystem?: () => void;
}

const PresentationView: React.FC<PresentationViewProps> = ({ onEnterSystem }) => {
  const { config } = useAppConfig();

  return (
    <div className="sentinela-page min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo + título */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 rounded-3xl overflow-hidden border border-[var(--sentinela-border)] flex items-center justify-center shadow-2xl">
            <img
              src={BRANDING.icon}
              alt={`Ícone ${BRANDING.name}`}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              {BRANDING.name}
            </h1>
            <p className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              {BRANDING.tagline}
            </p>
            <p className="mt-4 inline-flex px-3 py-1.5 rounded-full border border-[var(--sentinela-border)] text-xs text-[var(--sentinela-text-muted)]">
              Operação: {config.condominiumName}
            </p>
          </div>
        </div>

        {/* Frase de impacto */}
        <div className="space-y-3">
          <p className="text-sm sm:text-base text-zinc-200">
            Pensado para síndicos, portaria e administradoras que querem dar o próximo passo em
            organização, comunicação e controle operacional.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Segurança • Permissões por perfil • Offline
          </div>
        </div>

        {/* Três pontos rápidos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-[12px] sm:text-[13px]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="font-bold text-xs uppercase tracking-[0.18em] text-zinc-300 mb-1">
              Síndico
            </p>
            <p className="text-zinc-200">
              Visão clara de ocorrências, avisos, reservas e finanças em um único lugar.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="font-bold text-xs uppercase tracking-[0.18em] text-zinc-300 mb-1">
              Portaria
            </p>
            <p className="text-zinc-200">
              Registro rápido de visitantes, encomendas e ocorrências, mesmo com internet instável.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="font-bold text-xs uppercase tracking-[0.18em] text-zinc-300 mb-1">
              Administradora
            </p>
            <p className="text-zinc-200">
              Gestão centralizada de moradores, permissões e operação do condomínio.
            </p>
          </div>
        </div>

        {/* Botão para ir ao dashboard (síndico já autenticado) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onEnterSystem}
            className="sentinela-primary-action inline-flex items-center justify-center px-10 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] hover:scale-[1.02] active:scale-95"
          >
            Acessar central
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationView;

