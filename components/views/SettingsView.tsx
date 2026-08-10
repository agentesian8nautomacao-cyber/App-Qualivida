import React, { useState } from 'react';
import { Settings as SettingsIcon, Database, X, HelpCircle, ChevronDown, ChevronUp, ShieldCheck, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import CondominiumNameSection from '../settings/CondominiumNameSection';
import CondominiumWhatsAppSection from '../settings/CondominiumWhatsAppSection';
import WhatsAppTemplatesSection from '../settings/WhatsAppTemplatesSection';
import ThemeSelectionSection from '../settings/ThemeSelectionSection';
import AdminUsersSection from '../settings/AdminUsersSection';
import { Resident, Staff, Package, VisitorLog, Occurrence, Boleto, Notice } from '../../types';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface SettingsViewProps {
  onOpenAdminUserModal?: () => void;
  /** Abre a página de permissões RBAC (apenas Síndico/Administradora) */
  onOpenPermissions?: () => void;
  residents: Resident[];
  staff: Staff[];
  packages: Package[];
  visitors: VisitorLog[];
  occurrences: Occurrence[];
  boletos: Boleto[];
  notices: Notice[];
  reservations: {
    id: string;
    areaId: string;
    areaName: string;
    residentId: string;
    residentName: string;
    unit: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  }[];
}

const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenAdminUserModal,
  onOpenPermissions,
  residents,
  staff,
  packages,
  visitors,
  occurrences,
  boletos,
  notices,
  reservations,
}) => {
  const { config } = useAppConfig();
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [includeData, setIncludeData] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [singleFile, setSingleFile] = useState(true);
  const [expandedHelpId, setExpandedHelpId] = useState<string | null>(null);

  const helpItems: { id: string; title: string; content: React.ReactNode }[] = [
    {
      id: 'boletos',
      title: 'Acessando meus boletos',
      content: (
        <>
          <p className="mb-2">No menu lateral, acesse <strong>Boletos</strong>. Você verá a lista de boletos da sua unidade com mês de referência, vencimento e status (Pendente, Pago, etc.).</p>
          <p className="mb-2">Clique em um boleto para ver os detalhes. Quando houver PDF disponível, use o botão de download para baixar o boleto. Moradores podem ocultar boletos já pagos da lista, se desejar.</p>
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
      title: 'Encomendas',
      content: (
        <>
          <p className="mb-2"><strong>Portaria / Admin:</strong> Registre as encomendas recebidas na portaria em <strong>Encomendas</strong>. Informe destinatário, unidade e tipo. O morador será notificado e poderá ver no app.</p>
          <p className="mb-2"><strong>Morador:</strong> Suas encomendas aparecem no menu <strong>Encomendas</strong> ou no Dashboard. Após retirar na portaria, você pode ocultar a encomenda para limpar sua lista (a portaria continua com o registro).</p>
        </>
      ),
    },
    {
      id: 'reservas',
      title: 'Reservas de áreas comuns',
      content: (
        <>
          <p className="mb-2">Em <strong>Reservas</strong> você visualiza as áreas disponíveis (churrasqueira, salão de festas, etc.) e os horários já reservados.</p>
          <p className="mb-2">Moradores podem criar novas reservas escolhendo a área, data e horário. A portaria e a administração acompanham e gerenciam as reservas pelo mesmo menu.</p>
        </>
      ),
    },
    {
      id: 'ocorrencias',
      title: 'Ocorrências',
      content: (
        <>
          <p className="mb-2"><strong>Morador:</strong> Em <strong>Ocorrências</strong> você pode abrir uma nova ocorrência (reclamação, solicitação, etc.). Acompanhe o status e as respostas da administração. Quando a ocorrência for marcada como <strong>Resolvida</strong>, você pode excluí-la da sua lista.</p>
          <p className="mb-2"><strong>Síndico / Portaria / Admin:</strong> Visualizam todas as ocorrências, respondem às mensagens e podem marcar como <strong>Resolvido</strong>. Apenas ocorrências resolvidas podem ser excluídas.</p>
          <p>Novas respostas da administração aparecem no sino de notificações do morador.</p>
        </>
      ),
    },
    {
      id: 'notificacoes',
      title: 'Notificações (sino)',
      content: (
        <>
          <p className="mb-2">O ícone do <strong>sino</strong> no topo da tela exibe as notificações do morador: respostas em ocorrências e avisos do mural.</p>
          <p className="mb-2">Clique no sino para abrir a lista. Ao clicar em uma notificação, você é levado à página relacionada (ex.: ocorrência ou mural). Você pode marcar como lida ou excluir da lista pelo ícone de lixeira.</p>
        </>
      ),
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      content: (
        <>
          <p className="mb-2">O <strong>Dashboard</strong> é a tela inicial e mostra um resumo conforme seu perfil:</p>
          <p className="mb-2">Morador: avisos recentes, boletos, encomendas e reservas. Síndico/Admin/Portaria: visão geral com gráficos e acessos rápidos às principais áreas do sistema.</p>
        </>
      ),
    },
    {
      id: 'configuracoes',
      title: 'Configurações (esta página)',
      content: (
        <>
          <p className="mb-2">Acesso exclusivo do <strong>Síndico</strong>. Aqui você pode:</p>
          <ul className="list-disc pl-5 space-y-1 mb-2">
            <li>Alterar o <strong>nome do condomínio</strong> exibido no sistema</li>
            <li>Configurar o <strong>WhatsApp</strong> do condomínio e templates de mensagem</li>
            <li>Escolher o <strong>tema</strong> (claro/escuro)</li>
            <li>Gerenciar <strong>usuários administradores</strong> (portaria, síndico, etc.)</li>
            <li>Gerar <strong>Backup</strong> em PDF com dados e configurações</li>
          </ul>
        </>
      ),
    },
  ];

  const handleBackupClick = () => {
    setIsBackupModalOpen(true);
  };

  const handleCloseBackupModal = () => {
    setIsBackupModalOpen(false);
  };

  const handleGenerateBackup = () => {
    try {
      const now = new Date();
      const dateLabel = now.toLocaleString('pt-BR');
      const fileDate = now.toISOString().split('T')[0];

      const doc = new jsPDF();

      const addLine = (text: string, increment: number = 6) => {
        const marginBottom = 280;
        // @ts-expect-error jsPDF has internal pageSize
        const pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : 297;
        if (currentY > (pageHeight - 15) || currentY > marginBottom) {
          doc.addPage();
          currentY = 20;
          doc.setFontSize(12);
          doc.text(`CONDOMÍNIO ${(config?.condominiumName || 'QUALIVIDA CLUB RESIDENCE').toUpperCase()}`, 10, currentY);
          currentY += 6;
          doc.setFontSize(9);
          doc.text(`Relatório de backup — Emitido em: ${new Date().toLocaleString('pt-BR')}`, 10, currentY);
          currentY += 10;
          doc.setFontSize(10);
        }
        doc.text(text, 10, currentY);
        currentY += increment;
      };

      let currentY = 20;

      doc.setFontSize(12);
      doc.text(`CONDOMÍNIO ${(config?.condominiumName || 'QUALIVIDA CLUB RESIDENCE').toUpperCase()}`, 10, currentY);
      currentY += 6;
      doc.setFontSize(9);
      doc.text(`Relatório de backup — Emitido em: ${dateLabel}`, 10, currentY);
      currentY += 10;

      doc.setFontSize(16);
      addLine('Backup Completo do Sistema', 8);

      doc.setFontSize(11);
      addLine(`Gerado em: ${dateLabel}`, 7);

      doc.setFontSize(10);
      addLine('');
      addLine('Resumo geral:', 6);
      addLine(`- Moradores: ${residents.length}`);
      addLine(`- Funcionários: ${staff.length}`);
      addLine(`- Encomendas: ${packages.length}`);
      addLine(`- Visitantes: ${visitors.length}`);
      addLine(`- Ocorrências: ${occurrences.length}`);
      addLine(`- Avisos/Mural: ${notices.length}`);
      addLine(`- Boletos: ${boletos.length}`);
      addLine(`- Reservas de áreas: ${reservations.length}`);

      if (includeData) {
        addLine('');
        addLine('===============================');
        addLine('MORADORES', 7);
        residents.forEach((r) => {
          addLine(`${r.name} | Unidade ${r.unit} | Email: ${r.email || '-'} | Tel: ${r.phone || '-'}`);
        });

        addLine('');
        addLine('===============================');
        addLine('FUNCIONÁRIOS', 7);
        staff.forEach((s) => {
          addLine(`${s.name} | Cargo: ${s.role} | Turno: ${s.shift} | Status: ${s.status}`);
        });

        addLine('');
        addLine('===============================');
        addLine('ENCOMENDAS', 7);
        packages.forEach((p) => {
          addLine(
            `${p.recipient} | Unidade ${p.unit} | Tipo: ${p.type} | Status: ${p.status} | Recebida em: ${p.receivedAt}`
          );
        });

        addLine('');
        addLine('===============================');
        addLine('VISITANTES', 7);
        visitors.forEach((v) => {
          addLine(
            `${v.visitorName || v.residentName} | Unidade ${v.unit} | Entrada: ${v.entryTime} | Saída: ${
              v.exitTime || '-'
            } | Status: ${v.status}`
          );
        });

        addLine('');
        addLine('===============================');
        addLine('OCORRÊNCIAS', 7);
        occurrences.forEach((o) => {
          addLine(
            `Unidade ${o.unit} | ${o.residentName} | Status: ${o.status} | Data: ${o.date}`
          );
          addLine(`Descrição: ${o.description}`, 6);
          addLine('');
        });

        addLine('');
        addLine('===============================');
        addLine('AVISOS / MURAL', 7);
        notices.forEach((n) => {
          addLine(
            `${n.title} | Autor: ${n.author} (${n.authorRole}) | Data: ${n.date}`
          );
        });

        addLine('');
        addLine('===============================');
        addLine('BOLETOS', 7);
        boletos.forEach((b) => {
          addLine(
            `${b.residentName} | Unidade ${b.unit} | Ref: ${b.referenceMonth} | Venc.: ${b.dueDate} | Valor: R$ ${b.amount.toFixed(
              2
            )} | Status: ${b.status}`
          );
        });

        addLine('');
        addLine('===============================');
        addLine('RESERVAS DE ÁREAS', 7);
        reservations.forEach((r) => {
          addLine(
            `${r.areaName} | ${r.residentName} (${r.unit}) | Data: ${r.date} ${r.startTime}-${r.endTime} | Status: ${r.status}`
          );
        });
      }

      if (includeSettings) {
        addLine('');
        addLine('===============================');
        addLine('CONFIGURAÇÕES BÁSICAS', 7);
        addLine(
          'Inclui: nome do condomínio, temas, WhatsApp, templates e usuários administradores (detalhes visuais dentro do app).'
        );
      }

      doc.save(`backup-condominio-${fileDate}.pdf`);
    } catch (error) {
      // Fallback simples em caso de erro na geração
      alert('Não foi possível gerar o PDF de backup. Tente novamente.');
      return;
    }

    setIsBackupModalOpen(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 min-w-0 overflow-x-hidden px-1 sm:px-0">
      <header className="px-2 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <SettingsIcon className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--text-primary)] shrink-0" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-contrast-high leading-tight uppercase truncate">
              Configurações
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenPermissions && (
              <button
                type="button"
                onClick={onOpenPermissions}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all hover:scale-[1.02] shrink-0"
                style={{ 
                  backgroundColor: 'var(--glass-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                Permissões
              </button>
            )}
            <button
              type="button"
              onClick={handleBackupClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all hover:scale-[1.02] shrink-0"
              style={{ 
                backgroundColor: 'var(--glass-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <Database className="w-4 h-4" />
              Backup
            </button>
          </div>
        </div>
        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low">
          Personalize o sistema conforme suas necessidades
        </p>
      </header>

      <div className="space-y-6">
        <CondominiumNameSection />
        <CondominiumWhatsAppSection />
        <ThemeSelectionSection />
        <AdminUsersSection onOpenAdminUserModal={onOpenAdminUserModal} />
        <WhatsAppTemplatesSection />

        {/* Ajuda */}
        <section className="rounded-2xl border overflow-hidden min-w-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b min-w-0" style={{ borderColor: 'var(--border-color)' }}>
            <HelpCircle className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Ajuda
            </h3>
          </div>
          <p className="px-5 py-2 text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Informações de uso do sistema
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
      </div>

      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseBackupModal}
          />
          <div className="relative max-w-lg w-full rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{
              backgroundColor: 'var(--bg-color)',
              borderColor: 'var(--border-color)'
            }}
          >
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--text-primary)]" />
                <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-[var(--text-primary)]">
                  Backup do sistema
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseBackupModal}
                className="p-2 rounded-xl hover:bg-[var(--border-color)] transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-4 text-[11px] sm:text-xs">
              <p className="font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Escolha o tipo de backup que deseja gerar
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer hover:bg-[var(--border-color)]/40 transition-colors"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <span className="relative inline-flex shrink-0 mt-1">
                    <input
                      type="checkbox"
                      className="peer w-4 h-4 rounded border-2 border-[var(--border-color)] bg-[var(--bg-color)] cursor-pointer appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-[var(--bg-color)]"
                      checked={includeData}
                      onChange={(e) => setIncludeData(e.target.checked)}
                    />
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 peer-checked:opacity-100 text-[var(--text-primary)]">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  </span>
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-bold text-[11px] uppercase tracking-[0.18em]">
                      Dados do sistema
                    </p>
                    <p className="text-[var(--text-secondary)] text-[11px]">
                      Informações de moradores, reservas, ocorrências e demais registros operacionais.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer hover:bg-[var(--border-color)]/40 transition-colors"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <span className="relative inline-flex shrink-0 mt-1">
                    <input
                      type="checkbox"
                      className="peer w-4 h-4 rounded border-2 border-[var(--border-color)] bg-[var(--bg-color)] cursor-pointer appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-[var(--bg-color)]"
                      checked={includeSettings}
                      onChange={(e) => setIncludeSettings(e.target.checked)}
                    />
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 peer-checked:opacity-100 text-[var(--text-primary)]">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  </span>
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-bold text-[11px] uppercase tracking-[0.18em]">
                      Configurações
                    </p>
                    <p className="text-[var(--text-secondary)] text-[11px]">
                      Nome do condomínio, temas, configurações de WhatsApp, templates e usuários administradores.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl border cursor-pointer hover:bg-[var(--border-color)]/40 transition-colors"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <span className="relative inline-flex shrink-0 mt-1">
                    <input
                      type="checkbox"
                      className="peer w-4 h-4 rounded border-2 border-[var(--border-color)] bg-[var(--bg-color)] cursor-pointer appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-[var(--bg-color)]"
                      checked={singleFile}
                      onChange={(e) => setSingleFile(e.target.checked)}
                    />
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 peer-checked:opacity-100 text-[var(--text-primary)]">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  </span>
                  <div className="space-y-1">
                    <p className="text-[var(--text-primary)] font-bold text-[11px] uppercase tracking-[0.18em]">
                      Arquivo único
                    </p>
                    <p className="text-[var(--text-secondary)] text-[11px]">
                      Gerar um único arquivo compactado com todas as informações selecionadas.
                    </p>
                  </div>
                </label>
              </div>

              <p className="text-[10px] text-[var(--text-secondary)]">
                O sistema irá gerar um arquivo PDF com o resumo das opções de backup selecionadas.
              </p>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <button
                type="button"
                onClick={handleCloseBackupModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-[var(--border-color)]/40 transition-colors"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateBackup}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.18em] shadow-lg hover:shadow-xl transition-transform hover:scale-[1.01]"
                style={{
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--bg-color)'
                }}
              >
                Gerar backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
