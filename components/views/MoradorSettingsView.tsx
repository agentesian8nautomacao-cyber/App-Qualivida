import React, { useState } from 'react';
import { Settings as SettingsIcon, HelpCircle, ChevronDown, ChevronUp, Building2, Lock, Shield, Sliders, UserCircle, ChevronRight, MessageCircle, Info } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { openWhatsApp } from '../../utils/phoneNormalizer';

const helpItems: { id: string; title: string; content: React.ReactNode }[] = [
  {
    id: 'boletos',
    title: 'Acessando meus boletos',
    content: (
      <>
        <p className="mb-2">No menu lateral, acesse <strong>Financeiro</strong> ou <strong>Boletos</strong>. Você verá a lista de boletos da sua unidade com mês de referência, vencimento e status (Pendente, Pago, etc.).</p>
        <p className="mb-2">Clique em um boleto para ver os detalhes. Quando houver PDF disponível, use o botão de download para baixar o boleto. Você pode ocultar boletos já pagos da lista, se desejar.</p>
      </>
    ),
  },
  {
    id: 'comunicados',
    title: 'Como visualizar comunicados (Mural de Avisos)',
    content: (
      <>
        <p className="mb-2">Acesse <strong>Mural de Avisos</strong> no menu. Os avisos e comunicados da administração aparecem em cards.</p>
        <p className="mb-2">Leia o conteúdo e clique em <strong>Confirmar Leitura</strong> para marcar como lido. Depois de confirmar, você pode fechar o card com o botão <strong>X</strong> no canto superior direito para dispensá-lo da sua visualização.</p>
        <p>Os filtros permitem ver Todos, apenas Urgentes ou Não lidos.</p>
      </>
    ),
  },
  {
    id: 'encomendas',
    title: 'Minhas encomendas',
    content: (
      <>
        <p className="mb-2">Suas encomendas aparecem no <strong>Dashboard</strong> ou na área de resumo. Quando a portaria registrar uma encomenda para você, ela será exibida com destinatário, unidade e status.</p>
        <p>Após retirar na portaria, você pode ocultar a encomenda para limpar sua lista.</p>
      </>
    ),
  },
  {
    id: 'reservas',
    title: 'Reservas de áreas comuns',
    content: (
      <>
        <p className="mb-2">Em <strong>Reservas</strong> você visualiza as áreas disponíveis (churrasqueira, salão de festas, etc.) e os horários já reservados.</p>
        <p>Você pode criar novas reservas escolhendo a área, data e horário desejados.</p>
      </>
    ),
  },
  {
    id: 'ocorrencias',
    title: 'Ocorrências',
    content: (
      <>
        <p className="mb-2">Em <strong>Ocorrências</strong> você pode abrir uma nova ocorrência (reclamação, solicitação, etc.). Acompanhe o status e as respostas da administração pelo mesmo menu.</p>
        <p className="mb-2">Quando a ocorrência for marcada como <strong>Resolvida</strong>, você pode excluí-la da sua lista. Novas respostas da administração aparecem no sino de notificações.</p>
      </>
    ),
  },
  {
    id: 'notificacoes',
    title: 'Notificações (sino)',
    content: (
      <>
        <p className="mb-2">O ícone do <strong>sino</strong> no topo da tela exibe suas notificações: respostas em ocorrências e avisos do mural.</p>
        <p>Clique no sino para abrir a lista. Ao clicar em uma notificação, você é levado à página relacionada. Você pode excluir da lista pelo ícone de lixeira.</p>
      </>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    content: (
      <>
        <p className="mb-2">O <strong>Dashboard</strong> é a tela inicial e mostra um resumo: avisos recentes, boletos, encomendas e reservas da sua unidade.</p>
      </>
    ),
  },
];

interface MoradorSettingsViewProps {
  onGoToProfile?: () => void;
  onOpenChangePassword?: () => void;
}

const MoradorSettingsView: React.FC<MoradorSettingsViewProps> = ({ onGoToProfile, onOpenChangePassword }) => {
  const [expandedHelpId, setExpandedHelpId] = useState<string | null>(null);
  const { config } = useAppConfig();
  const hasCondominiumWhatsApp = Boolean(config.condominiumWhatsApp?.trim());

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <header className="px-2">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-[var(--text-primary)]" />
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-contrast-high leading-tight uppercase">
            Configurações
          </h2>
        </div>
        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low">
          Conta, segurança, contato e ajuda para usar o app
        </p>
      </header>

      <div className="space-y-6">
        {/* Conta e segurança — ações diretas */}
        <section className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <UserCircle className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Conta e segurança
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)' }}>
                  <Building2 className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black uppercase tracking-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    Meu perfil e unidade
                  </h4>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Edite nome, contatos, CPF e dados do veículo.
                  </p>
                </div>
              </div>
              {onGoToProfile && (
                <button
                  type="button"
                  onClick={onGoToProfile}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                  style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  Abrir Meu Perfil
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)' }}>
                  <Lock className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black uppercase tracking-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    Alterar senha
                  </h4>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Mantenha sua senha em sigilo e altere quando necessário.
                  </p>
                </div>
              </div>
              {onOpenChangePassword && (
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                  style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  Alterar senha
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Contato do condomínio */}
        <section className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <MessageCircle className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Contato do condomínio
            </h3>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-bold uppercase tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
              {config.condominiumName}
            </p>
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              Dúvidas, sugestões ou problemas? Entre em contato com a administração.
            </p>
            {hasCondominiumWhatsApp && (
              <button
                type="button"
                onClick={() => openWhatsApp(config.condominiumWhatsApp)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}
              >
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </button>
            )}
            {!hasCondominiumWhatsApp && (
              <p className="text-[11px] italic" style={{ color: 'var(--text-secondary)' }}>
                Canal de contato configurado pela administração aparecerá aqui.
              </p>
            )}
          </div>
        </section>

        {/* Privacidade e uso */}
        <section className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <Shield className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Privacidade e uso
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)' }}>
                <Lock className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                  Privacidade
                </h4>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Seus dados são usados apenas para o funcionamento do condomínio. A administração tem acesso somente às informações necessárias ao uso do sistema.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border-color)' }}>
                <Sliders className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                  Funcionalidades do app
                </h4>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  O app exibe as opções do seu perfil: boletos, mural de avisos, reservas, ocorrências e notificações. O modo claro/escuro pode ser alterado pelo ícone no topo da tela.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ajuda */}
        <section className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <HelpCircle className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Ajuda
            </h3>
          </div>
          <p className="px-5 py-2 text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Como usar o sistema
          </p>
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {helpItems.map((item) => {
              const isExpanded = expandedHelpId === item.id;
              return (
                <div key={item.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setExpandedHelpId(isExpanded ? null : item.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="font-bold text-sm uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 shrink-0 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 shrink-0 text-[var(--text-secondary)]" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Sobre */}
        <section className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <Info className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Sobre
            </h3>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-bold uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {config.condominiumName} Gestão
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              Sistema de gestão para condomínios. Boletos, avisos, reservas, ocorrências e mais.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MoradorSettingsView;
