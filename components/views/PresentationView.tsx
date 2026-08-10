import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface PresentationViewProps {
  /** Chamado quando o usuário decide ir para o login. */
  onEnterSystem?: () => void;
}

const PresentationView: React.FC<PresentationViewProps> = ({ onEnterSystem }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#020617] via-[#020817] to-[#020617] text-white px-4 py-10">
      <div className="w-full max-w-xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo + título */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20 rounded-3xl overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center shadow-2xl">
            <img
              src="/1024.png"
              alt="Logo Qualivida"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Qualivida Residence
            </h1>
            <p className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Gestão simples, moderna e segura para o condomínio
            </p>
          </div>
        </div>

        {/* Frase de impacto */}
        <div className="space-y-3">
          <p className="text-sm sm:text-base text-zinc-200">
            Pensado para síndicos, portaria e moradores que já usam um app hoje, mas querem dar o
            próximo passo em organização, comunicação e controle.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
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
              Morador
            </p>
            <p className="text-zinc-200">
              Acesso fácil a avisos, boletos, reservas e comunicação com a administração.
            </p>
          </div>
        </div>

        {/* Botão para ir ao dashboard (síndico já autenticado) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onEnterSystem}
            className="inline-flex items-center justify-center px-10 py-3 rounded-2xl bg-white text-emerald-700 text-[11px] font-black uppercase tracking-[0.25em] hover:scale-[1.02] active:scale-95 shadow-2xl"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationView;

