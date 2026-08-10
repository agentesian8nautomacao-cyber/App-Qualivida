import React, { useState, useMemo, useRef } from 'react';
import {
  Receipt,
  TrendingUp,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Filter,
  Download,
  Users,
  Home,
  BarChart3,
  PieChart,
  Plus,
  Edit,
  Trash2,
  FileText,
  FolderOpen,
  FileSpreadsheet,
  Upload,
  Loader2,
  X,
} from 'lucide-react';
import { Boleto, Resident, FinancialEntry, UserRole } from '../../types';
import { useAppConfig } from '../../contexts/AppConfigContext';
import BoletosView from './BoletosView';
import DetailedChartsModal from '../modals/DetailedChartsModal';
import FinancialEntryModal from '../modals/FinancialEntryModal';
import { importBoletosFromPdfFiles, type ImportItem } from '../../services/boletoPdfImportService';
import { useFinancialEntries } from '../../hooks/useFinancialEntries';
import { saveBoleto, getBoletos } from '../../services/dataService';
import { useToast } from '../../contexts/ToastContext';
import { listDocumentos, uploadDocumento, getDocumentoPublicUrl, type DocumentoItem } from '../../services/documentosService';

interface FinanceiroViewProps {
  allBoletos: Boleto[];
  boletoSearch: string;
  setBoletoSearch: (val: string) => void;
  allResidents: Resident[];
  onViewBoleto?: (boleto: Boleto) => void;
  onDownloadBoleto?: (boleto: Boleto) => void;
  onDeleteBoleto?: (boleto: Boleto) => void;
  showImportButton?: boolean;
  currentResident?: Resident | null;
  role: UserRole;
  isLoadingBoletos?: boolean;
  onImportSuccess?: () => void; // Callback quando importação for bem-sucedida
  onImportClick?: () => void; // Callback para importação (removido pois não é usado)
}

type FinancialTab = 'boletos' | 'balancete' | 'documentos';
type PeriodFilter = 'mes' | 'trimestre' | 'ano' | 'mes_especifico' | 'total';

interface FinancialMetrics {
  totalReceita: number;
  totalDespesa: number;
  saldoAtual: number;
  boletosPagos: number;
  boletosPendentes: number;
  boletosVencidos: number;
  receitaPorTipo: {
    condominio: number;
    agua: number;
    luz: number;
  };
  despesaPorTipo: {
    condominio: number;
    agua: number;
    luz: number;
  };
  // Entradas manuais
  receitasManuais: number;
  despesasManuais: number;
  totalReceitaComManual: number;
  totalDespesaComManual: number;
  saldoAtualComManual: number;
}

// Função para calcular métricas financeiras
const calculateFinancialMetrics = (
  boletos: Boleto[],
  periodFilter: PeriodFilter,
  selectedMonth: number,
  selectedYear: number,
  financialEntries: FinancialEntry[],
  currentDate: Date = new Date()
): FinancialMetrics => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filtrar boletos por período
  const filteredBoletos = boletos.filter(boleto => {
    const boletoDate = new Date(boleto.dueDate);

    switch (periodFilter) {
      case 'mes':
        return boletoDate.getMonth() === currentMonth && boletoDate.getFullYear() === currentYear;
      case 'trimestre':
        const currentQuarter = Math.floor(currentMonth / 3);
        const boletoQuarter = Math.floor(boletoDate.getMonth() / 3);
        return boletoQuarter === currentQuarter && boletoDate.getFullYear() === currentYear;
      case 'ano':
        return boletoDate.getFullYear() === currentYear;
      case 'mes_especifico':
        return boletoDate.getMonth() === selectedMonth && boletoDate.getFullYear() === selectedYear;
      case 'total':
      default:
        return true;
    }
  });

  // Calcular métricas
  const totalReceita = filteredBoletos
    .filter(b => b.status === 'Pago')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalDespesa = filteredBoletos
    .filter(b => b.status === 'Pago')
    .reduce((sum, b) => sum + b.amount, 0); // Por enquanto despesa = receita (simplificado)

  const saldoAtual = totalReceita - totalDespesa;

  const boletosPagos = filteredBoletos.filter(b => b.status === 'Pago').length;
  const boletosPendentes = filteredBoletos.filter(b => b.status === 'Pendente').length;
  const boletosVencidos = filteredBoletos.filter(b => b.status === 'Vencido').length;

  // Receita por tipo (apenas boletos pagos)
  const receitaPorTipo = filteredBoletos
    .filter(b => b.status === 'Pago')
    .reduce((acc, b) => {
      const tipo = b.boletoType || 'condominio';
      acc[tipo as keyof typeof acc] += b.amount;
      return acc;
    }, { condominio: 0, agua: 0, luz: 0 });

  // Despesa por tipo (igual à receita por enquanto)
  const despesaPorTipo = { ...receitaPorTipo };

  // Calcular totais das entradas manuais para o período
  const periodMonth = periodFilter === 'mes_especifico' ? selectedMonth : currentMonth;
  const periodYear = periodFilter === 'mes_especifico' ? selectedYear : currentYear;

  const manualTotals = financialEntries
    .filter(entry => {
      const entryDate = new Date(entry.date);
      const entryMonth = entryDate.getMonth();
      const entryYear = entryDate.getFullYear();

      switch (periodFilter) {
        case 'mes':
        case 'mes_especifico':
          return entryMonth === periodMonth && entryYear === periodYear;
        case 'trimestre': {
          const currentQuarter = Math.floor(currentMonth / 3);
          const entryQuarter = Math.floor(entryMonth / 3);
          return entryQuarter === currentQuarter && entryYear === currentYear;
        }
        case 'ano':
          return entryYear === currentYear;
        case 'total':
        default:
          return true;
      }
    })
    .reduce(
      (acc, entry) => {
        if (entry.type === 'receita') {
          acc.receitasManuais += entry.amount;
        } else {
          acc.despesasManuais += entry.amount;
        }
        return acc;
      },
      { receitasManuais: 0, despesasManuais: 0 }
    );

  const totalReceitaComManual = totalReceita + manualTotals.receitasManuais;
  const totalDespesaComManual = totalDespesa + manualTotals.despesasManuais;
  const saldoAtualComManual = totalReceitaComManual - totalDespesaComManual;

  return {
    totalReceita,
    totalDespesa,
    saldoAtual,
    boletosPagos,
    boletosPendentes,
    boletosVencidos,
    receitaPorTipo,
    despesaPorTipo,
    receitasManuais: manualTotals.receitasManuais,
    despesasManuais: manualTotals.despesasManuais,
    totalReceitaComManual,
    totalDespesaComManual,
    saldoAtualComManual
  };
};

const FinanceiroView: React.FC<FinanceiroViewProps> = ({
  allBoletos,
  boletoSearch,
  setBoletoSearch,
  allResidents,
  onViewBoleto,
  onDownloadBoleto,
  onDeleteBoleto,
  showImportButton = true,
  currentResident,
  role,
  isLoadingBoletos = false,
  onImportSuccess
}) => {
  const isManagerRole = ['SINDICO', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA'].includes(role);
  const { config } = useAppConfig();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<FinancialTab>('boletos');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('mes');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isDetailedChartsOpen, setIsDetailedChartsOpen] = useState(false);
  const importPdfPickerRef = useRef<HTMLInputElement>(null);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isImportingPdfs, setIsImportingPdfs] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [documentosStorage, setDocumentosStorage] = useState<DocumentoItem[]>([]);
  const [documentosLoading, setDocumentosLoading] = useState(false);
  const [documentoUploading, setDocumentoUploading] = useState(false);
  const [showImportDocumentModal, setShowImportDocumentModal] = useState(false);
  const [importDocumentCategoryId, setImportDocumentCategoryId] = useState<string>('');
  const documentoInputRef = useRef<HTMLInputElement>(null);

  /** IDs das categorias de documentos (para listar storage e modal de importação). */
  const DOCUMENT_CATEGORY_IDS = useMemo(
    () => ['inadimplencia', 'controle-financeiro', 'receitas-despesas', 'itens-controle', 'demonstrativos', 'regime-interno', 'convencao'],
    []
  );

  const canImportDocuments = isManagerRole; // Síndico e perfis Admin podem importar documentos

  const importSummary = useMemo(() => {
    const total = importItems.length;
    const ok = importItems.filter((i) => i.status === 'sucesso').length;
    const err = importItems.filter((i) => i.status === 'erro').length;
    const processing = importItems.filter((i) => i.status === 'processando').length;
    return { total, ok, err, processing };
  }, [importItems]);

  const runPdfImport = async (files: File[]) => {
    const list = (files || []).filter(Boolean);
    if (!list.length) return;

    setShowImportPanel(true);
    setIsImportingPdfs(true);
    setImportItems(list.map((f) => ({ key: `${f.name}::${f.size}::${f.lastModified}`, file: f, status: 'pendente' } as ImportItem)));

    const { successCount, errorCount } = await importBoletosFromPdfFiles({
      files: list,
      allResidents,
      existingBoletos: allBoletos,
      onProgress: (item) => {
        setImportItems((prev) => {
          const idx = prev.findIndex((p) => p.key === item.key);
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = item;
          return next;
        });
      }
    });

    setIsImportingPdfs(false);

    if (successCount > 0) {
      toast.success(`${successCount} boleto(s) importado(s) com sucesso.`);
      onImportSuccess?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} arquivo(s) com erro na importação. Veja os detalhes no painel.`);
    }
  };

  // Estados para entradas manuais
  const [isReceitaModalOpen, setIsReceitaModalOpen] = useState(false);
  const [isDespesaModalOpen, setIsDespesaModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);

  // Hook para gerenciar entradas financeiras
  const {
    entries: financialEntries,
    loading: loadingEntries,
    error: financialEntriesError,
    addEntry,
    updateEntry,
    deleteEntry,
    getTotalsByPeriod
  } = useFinancialEntries();

  // Carregar lista de documentos do storage quando abrir aba Documentos
  React.useEffect(() => {
    if (activeTab !== 'documentos') return;
    setDocumentosLoading(true);
    listDocumentos(DOCUMENT_CATEGORY_IDS)
      .then(setDocumentosStorage)
      .catch(() => setDocumentosStorage([]))
      .finally(() => setDocumentosLoading(false));
  }, [activeTab, DOCUMENT_CATEGORY_IDS]);

  // Debug: monitorar mudanças no estado da importação PDF (não-modal)
  React.useEffect(() => {
    console.log('[FinanceiroView] Importação PDFs:', {
      isImportingPdfs,
      total: importSummary.total,
      ok: importSummary.ok,
      err: importSummary.err,
      processing: importSummary.processing
    });
  }, [isImportingPdfs, importSummary.total, importSummary.ok, importSummary.err, importSummary.processing]);

  // Log de inicialização do componente
  console.log('[FinanceiroView] Inicializando componente:', {
    role,
    allBoletosCount: allBoletos?.length || 0,
    financialEntriesCount: financialEntries?.length || 0,
    loadingEntries,
    financialEntriesError,
    activeTab
  });

  // Verificar se há erro crítico no carregamento das entradas financeiras
  if (financialEntriesError) {
    console.error('[FinanceiroView] Erro crítico no carregamento das entradas financeiras:', financialEntriesError);
    throw new Error(`Erro ao carregar dados financeiros: ${financialEntriesError}`);
  }

  // Verificar se os dados necessários estão disponíveis
  if (!allBoletos || !Array.isArray(allBoletos)) {
    console.error('[FinanceiroView] allBoletos não é um array válido:', allBoletos);
    throw new Error('Dados de boletos não disponíveis');
  }

  if (!allResidents || !Array.isArray(allResidents)) {
    console.error('[FinanceiroView] allResidents não é um array válido:', allResidents);
    throw new Error('Dados de moradores não disponíveis');
  }

  console.log('[FinanceiroView] Dados validados com sucesso, renderizando componente');

  // Categorias da área Documentos (arquivos estáticos em /public/docs)
  const documentCategories: { id: string; title: string; files: { label: string; format: 'pdf' | 'xlsx'; url: string }[] }[] = [
    {
      id: 'inadimplencia',
      title: 'Inadimplência',
      files: [
        { label: 'Relatório', format: 'pdf', url: '/docs/inadimplencia-relatorio.pdf' },
        { label: 'Planilha', format: 'xlsx', url: '/docs/inadimplencia-planilha.xlsx' }
      ]
    },
    {
      id: 'controle-financeiro',
      title: 'Planilha para controle financeiro',
      files: [{ label: 'Planilha', format: 'xlsx', url: '/docs/controle-financeiro-planilha.xlsx' }]
    },
    {
      id: 'receitas-despesas',
      title: 'Receitas e despesas',
      files: [
        { label: 'Planilha', format: 'xlsx', url: '/docs/receitas-despesas-planilha.xlsx' },
        { label: 'Relatório', format: 'pdf', url: '/docs/receitas-despesas-relatorio.pdf' }
      ]
    },
    {
      id: 'itens-controle',
      title: 'Itens de controles',
      files: [
        { label: 'Planilha', format: 'xlsx', url: '/docs/itens-controle-planilha.xlsx' },
        { label: 'Documento', format: 'pdf', url: '/docs/itens-controle-documento.pdf' }
      ]
    },
    {
      id: 'demonstrativos',
      title: 'Demonstrativos sintéticos',
      files: [
        { label: 'PDF', format: 'pdf', url: '/docs/demonstrativos-sinteticos.pdf' },
        { label: 'Planilha', format: 'xlsx', url: '/docs/demonstrativos-sinteticos.xlsx' }
      ]
    },
    {
      id: 'regime-interno',
      title: 'Regime interno (autenticado)',
      files: [{ label: 'Documento', format: 'pdf', url: '/docs/regimento-interno.pdf' }]
    },
    {
      id: 'convencao',
      title: 'Convenção',
      files: [{ label: 'Documento', format: 'pdf', url: '/docs/convencao-condominio.pdf' }]
    }
  ];

  // Função para exportar relatório financeiro
  // Funções para gerenciar entradas manuais
  const handleSaveEntry = async (entryData: Omit<FinancialEntry, 'id' | 'createdAt'>) => {
    try {
      if (editingEntry) {
        await updateEntry(editingEntry.id, entryData);
      } else {
        await addEntry(entryData);
      }
    } catch (error) {
      console.error('Erro ao salvar entrada:', error);
      alert('Erro ao salvar entrada. Tente novamente.');
    }
  };

  const handleEditEntry = (entry: FinancialEntry) => {
    setEditingEntry(entry);
    if (entry.type === 'receita') {
      setIsReceitaModalOpen(true);
    } else {
      setIsDespesaModalOpen(true);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta entrada?')) {
      try {
        await deleteEntry(entryId);
      } catch (error) {
        console.error('Erro ao excluir entrada:', error);
        alert('Erro ao excluir entrada. Tente novamente.');
      }
    }
  };

  const handleImportBoletos = async (boletosToImport: Boleto[]) => {
    console.log('[FinanceiroView] Iniciando importação de', boletosToImport.length, 'boletos');

    // Importar boletos um por um
    const importedIds: string[] = [];
    for (const boleto of boletosToImport) {
      try {
        console.log('[FinanceiroView] Importando boleto:', boleto.unit, boleto.referenceMonth);
        const result = await saveBoleto(boleto);
        if (result.success && result.id) {
          importedIds.push(result.id);
        } else {
          console.error('[FinanceiroView] Falha ao importar boleto:', result.error);
        }
      } catch (error) {
        console.error('[FinanceiroView] Erro ao importar boleto:', error);
      }
    }

    if (importedIds.length > 0) {
      console.log('[FinanceiroView] Importação concluída:', importedIds.length, 'boletos importados');
      toast.success(`${importedIds.length} boleto(s) importado(s) com sucesso!`);

      // Chamar callback se fornecido
      if (onImportSuccess) {
        onImportSuccess();
      }
    } else {
      toast.error('Nenhum boleto foi importado. Verifique os logs para mais detalhes.');
    }
  };

  const closeEntryModals = () => {
    setIsReceitaModalOpen(false);
    setIsDespesaModalOpen(false);
    setEditingEntry(null);
  };

  const exportFinancialReport = () => {
    const reportData = {
      cabecalho: {
        condominio: config.condominiumName || 'QUALIVIDA CLUB RESIDENCE',
        identificacao: 'Relatório Financeiro',
        dataEmissao: new Date().toLocaleString('pt-BR')
      },
      periodo: periodFilter,
      dataGeracao: new Date().toLocaleString('pt-BR'),
      resumoGeral: {
        totalReceita: metrics.totalReceitaComManual,
        totalDespesa: metrics.totalDespesaComManual,
        saldoAtual: metrics.saldoAtualComManual,
        boletosPagos: metrics.boletosPagos,
        boletosPendentes: metrics.boletosPendentes,
        boletosVencidos: metrics.boletosVencidos,
        receitasManuais: metrics.receitasManuais,
        despesasManuais: metrics.despesasManuais
      },
      receitasPorTipo: metrics.receitaPorTipo,
      despesasPorTipo: metrics.despesaPorTipo,
      entradasManuais: financialEntries.filter(entry => {
        // Filtrar entradas do período
        const entryDate = new Date(entry.date);
        switch (periodFilter) {
          case 'mes':
            return entryDate.getMonth() === new Date().getMonth() && entryDate.getFullYear() === new Date().getFullYear();
          case 'mes_especifico':
            return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
          case 'trimestre': {
            const currentQuarter = Math.floor(new Date().getMonth() / 3);
            const entryQuarter = Math.floor(entryDate.getMonth() / 3);
            return entryQuarter === currentQuarter && entryDate.getFullYear() === new Date().getFullYear();
          }
          case 'ano':
            return entryDate.getFullYear() === new Date().getFullYear();
          case 'total':
          default:
            return true;
        }
      }).map(entry => ({
        tipo: entry.type,
        categoria: entry.category,
        descricao: entry.description,
        valor: entry.amount,
        data: entry.date,
        registradoPor: entry.createdBy
      })),
      quebraMensal: allBoletos.reduce((acc, boleto) => {
        const date = new Date(boleto.dueDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });

        if (!acc[monthKey]) {
          acc[monthKey] = {
            mes: monthName,
            receita: 0,
            despesa: 0,
            boletosPagos: 0,
            boletosPendentes: 0,
            boletosVencidos: 0
          };
        }

        if (boleto.status === 'Pago') {
          acc[monthKey].receita += boleto.amount;
          acc[monthKey].despesa += boleto.amount;
          acc[monthKey].boletosPagos += 1;
        } else if (boleto.status === 'Pendente') {
          acc[monthKey].boletosPendentes += 1;
        } else if (boleto.status === 'Vencido') {
          acc[monthKey].boletosVencidos += 1;
        }

        return acc;
      }, {} as Record<string, any>),
      ...(isManagerRole && {
        resumoPorResidente: allResidents.map(resident => {
          const residentBoletos = allBoletos.filter(b =>
            b.residentName === resident.name && b.unit === resident.unit
          );
          const totalPago = residentBoletos
            .filter(b => b.status === 'Pago')
            .reduce((sum, b) => sum + b.amount, 0);

          return {
            residente: resident.name,
            unidade: resident.unit,
            totalPago,
            boletosPagos: residentBoletos.filter(b => b.status === 'Pago').length,
            boletosPendentes: residentBoletos.filter(b => b.status === 'Pendente').length,
            boletosVencidos: residentBoletos.filter(b => b.status === 'Vencido').length,
            status: residentBoletos.filter(b => b.status === 'Pendente' || b.status === 'Vencido').length === 0 ? 'em_dia' : 'pendente'
          };
        }).sort((a, b) => b.totalPago - a.totalPago)
      })
    };

    // Criar arquivo JSON para download
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `relatorio-financeiro-${periodFilter}-${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Calcular métricas do balancete (sempre, independente da aba ativa)
  const metrics = useMemo(() =>
    calculateFinancialMetrics(allBoletos, periodFilter, selectedMonth, selectedYear, financialEntries),
    [allBoletos, periodFilter, selectedMonth, selectedYear, financialEntries]
  );

  if (activeTab === 'boletos') {
    return (
      <div className="space-y-6">
        {/* Header com navegação interna */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
          <button
            onClick={() => setActiveTab('balancete')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <TrendingUp className="w-4 h-4" />
            Balancete
          </button>
          <div className="text-xs opacity-50 font-bold uppercase tracking-widest">|</div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--text-primary) text-(--bg-color) text-sm font-bold">
            <Receipt className="w-4 h-4" />
            Boletos
          </div>
          <div className="text-xs opacity-50 font-bold uppercase tracking-widest">|</div>
          <button
            onClick={() => setActiveTab('documentos')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <FolderOpen className="w-4 h-4" />
            Documentos
          </button>
        </div>

        {/* Painel inline de status (não-modal)
            OBS: Quando o painel está aberto, ocultamos a lista de boletos para evitar "cards duplicados"
            (o painel já mostra o resultado da importação). */}
        {showImportPanel && (
          <div className="premium-glass rounded-2xl p-4 border border-(--border-color)">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest opacity-60">Importação de PDFs</p>
                <p className="text-sm font-bold mt-1">
                  {isImportingPdfs ? 'Processando...' : 'Finalizado'}
                  {importSummary.total ? ` • ${importSummary.ok} OK • ${importSummary.err} erro(s)` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isImportingPdfs && showImportButton && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) text-xs font-black uppercase tracking-widest"
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => {
                      try {
                        importPdfPickerRef.current?.click();
                      } catch {}
                    }}
                    title="Importar mais PDFs"
                  >
                    Importar mais
                  </button>
                )}
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) text-xs font-black uppercase tracking-widest"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => setShowImportPanel(false)}
                  disabled={isImportingPdfs}
                  title={isImportingPdfs ? 'Aguarde terminar para fechar' : 'Fechar'}
                >
                  Fechar
                </button>
              </div>
            </div>

            {importItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {importItems.map((it) => (
                  <div
                    key={it.key}
                    className="rounded-xl border border-(--border-color) p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black truncate">{it.file.name}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {it.extracted?.unidade ? `Unidade: ${it.extracted.unidade}` : 'Unidade: —'} •{' '}
                        {it.extracted?.referencia ? `Ref: ${it.extracted.referencia}` : 'Ref: —'} •{' '}
                        {it.resident ? `Morador: ${it.resident.name}` : 'Morador: —'}
                      </p>
                      {it.message && (
                        <p className={`text-xs mt-1 ${it.status === 'erro' ? 'text-red-400' : 'opacity-70'}`}>{it.message}</p>
                      )}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-70">
                      {it.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conteúdo dos Boletos (oculto enquanto o painel de importação estiver aberto) */}
        {!showImportPanel && (
          <BoletosView
            allBoletos={allBoletos}
            boletoSearch={boletoSearch}
            setBoletoSearch={setBoletoSearch}
            allResidents={allResidents}
            onViewBoleto={onViewBoleto}
            onDownloadBoleto={onDownloadBoleto}
            onDeleteBoleto={onDeleteBoleto}
            showImportButton={showImportButton}
            isResidentView={role === 'MORADOR'}
            currentResident={role === 'MORADOR' ? currentResident : null}
            isLoading={isLoadingBoletos}
            role={role}
            onImportPdfsSelected={(files) => {
              // legado (não usamos mais modal). Mantém compatibilidade.
              if (files?.length) runPdfImport(files);
            }}
            onImportBoletos={() => {
              // Fluxo solicitado: abrir direto o explorador do SO (sem modal).
              try {
                importPdfPickerRef.current?.click();
              } catch {}
            }}
          />
        )}

        {/* File picker oculto (acionado pelo botão "Importar Boletos") */}
        <input
          ref={importPdfPickerRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []).filter(Boolean);
            try {
              e.currentTarget.value = '';
            } catch {}
            if (files.length > 0) {
              console.log('[FinanceiroView] PDFs selecionados no file picker:', files.length);
              runPdfImport(files);
            }
          }}
        />
      </div>
    );
  }

  // Documentos View
  if (activeTab === 'documentos') {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
          <button
            onClick={() => setActiveTab('balancete')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <TrendingUp className="w-4 h-4" />
            Balancete
          </button>
          <div className="text-xs opacity-50 font-bold uppercase tracking-widest">|</div>
          <button
            onClick={() => setActiveTab('boletos')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <Receipt className="w-4 h-4" />
            Boletos
          </button>
          <div className="text-xs opacity-50 font-bold uppercase tracking-widest">|</div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--text-primary) text-(--bg-color) text-sm font-bold">
            <FolderOpen className="w-4 h-4" />
            Documentos
          </div>
        </div>

        <div className="premium-glass rounded-2xl p-6 border border-(--border-color) w-full max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <FolderOpen className="w-8 h-8 text-[var(--text-primary)] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xl font-black uppercase tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                  Documentos
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Arquivos disponíveis para download (PDF, XLSX)
                </p>
              </div>
            </div>
            {canImportDocuments && (
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={documentoInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !importDocumentCategoryId) return;
                    e.target.value = '';
                    setDocumentoUploading(true);
                    const result = await uploadDocumento(file, importDocumentCategoryId);
                    setDocumentoUploading(false);
                    if ('error' in result) {
                      toast.error(result.error || 'Erro ao enviar documento.');
                      return;
                    }
                    toast.success('Documento importado com sucesso.');
                    setShowImportDocumentModal(false);
                    setImportDocumentCategoryId('');
                    listDocumentos(DOCUMENT_CATEGORY_IDS).then(setDocumentosStorage);
                  }}
                />
                <button
                  type="button"
                  disabled={documentoUploading}
                  onClick={() => setShowImportDocumentModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold disabled:opacity-60"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {documentoUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Importar Documento
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {documentCategories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border p-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <h4 className="text-sm font-black uppercase tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
                  {cat.title}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {cat.files.map((file, idx) => {
                    const hasUrl = Boolean(file.url && file.url.trim());
                    const ext = file.format.toUpperCase();
                    return (
                      <button
                        key={`${cat.id}-${idx}`}
                        type="button"
                        disabled={!hasUrl}
                        onClick={() => {
                          if (hasUrl) {
                            const a = document.createElement('a');
                            a.href = file.url;
                            a.target = '_blank';
                            a.rel = 'noopener noreferrer';
                            a.download = `${cat.title.replace(/\s+/g, '-')}-${file.label || file.format}.${file.format}`;
                            a.click();
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                          hasUrl
                            ? 'border-(--border-color) hover:bg-(--border-color) cursor-pointer'
                            : 'opacity-60 cursor-not-allowed border-(--border-color)'
                        }`}
                        style={{ color: 'var(--text-primary)' }}
                        title={hasUrl ? `Baixar ${file.label || ext}` : 'Em breve'}
                      >
                        {file.format === 'xlsx' ? (
                          <FileSpreadsheet className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                        <span>{file.label || ext}</span>
                        <span className="text-[10px] opacity-70">.{file.format}</span>
                      </button>
                    );
                  })}
                  {!documentosLoading &&
                    documentosStorage
                      .filter((d) => d.categoryId === cat.id)
                      .map((doc) => {
                        const url = getDocumentoPublicUrl(doc.path);
                        const ext = doc.name.split('.').pop()?.toLowerCase() || '';
                        return (
                          <a
                            key={doc.path}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={doc.name}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all border-(--border-color) hover:bg-(--border-color) cursor-pointer"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {ext === 'xlsx' || ext === 'xls' ? (
                              <FileSpreadsheet className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            <span className="truncate max-w-[180px]">{doc.name}</span>
                          </a>
                        );
                      })}
                </div>
              </div>
            ))}

            {/* Modal: Importar documento — escolher categoria e arquivo */}
            {canImportDocuments && showImportDocumentModal && (
              <>
                <div
                  className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                  onClick={() => !documentoUploading && setShowImportDocumentModal(false)}
                  aria-hidden="true"
                />
                <div
                  className="fixed left-1/2 top-1/2 z-[61] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-xl"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      Importar documento
                    </h3>
                    <button
                      type="button"
                      onClick={() => !documentoUploading && setShowImportDocumentModal(false)}
                      className="rounded-xl p-2 opacity-70 hover:opacity-100"
                      style={{ color: 'var(--text-primary)' }}
                      aria-label="Fechar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="mb-3 text-xs opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Selecione a categoria e depois o arquivo (PDF ou XLSX).
                  </p>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Categoria
                  </label>
                  <select
                    value={importDocumentCategoryId}
                    onChange={(e) => setImportDocumentCategoryId(e.target.value)}
                    className="mb-4 w-full rounded-xl border px-3 py-2.5 text-sm"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--glass-bg)' }}
                  >
                    <option value="">Selecione a categoria</option>
                    {documentCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!importDocumentCategoryId || documentoUploading}
                      onClick={() => documentoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--glass-bg)' }}
                    >
                      {documentoUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Selecionar arquivo
                    </button>
                    <button
                      type="button"
                      onClick={() => !documentoUploading && setShowImportDocumentModal(false)}
                      className="rounded-xl border px-4 py-2 text-sm font-bold"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Balancete View Completo
  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-w-0 w-full max-w-full overflow-x-hidden">
      {/* Header com navegação interna */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--text-primary) text-(--bg-color) text-sm font-bold">
          <TrendingUp className="w-4 h-4" />
          Balancete
        </div>
        <div className="text-xs opacity-50 font-bold uppercase tracking-widest">|</div>
        <button
          onClick={() => setActiveTab('boletos')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          <Receipt className="w-5 h-5" />
          Boletos
        </button>
        <div className="text-xs opacity-50 font-bold uppercase tracking-widest">|</div>
        <button
          onClick={() => setActiveTab('documentos')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          <FolderOpen className="w-4 h-4" />
          Documentos
        </button>
      </div>

      {/* Filtros de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 w-full max-w-full">
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 opacity-70" />
          <span className="text-sm font-medium opacity-80">Período:</span>
        </div>
        <div className="flex flex-wrap gap-2 min-w-0">
          {[
            { key: 'mes' as PeriodFilter, label: 'Este Mês' },
            { key: 'trimestre' as PeriodFilter, label: 'Este Trimestre' },
            { key: 'ano' as PeriodFilter, label: 'Este Ano' },
            { key: 'mes_especifico' as PeriodFilter, label: 'Mês Específico' },
            { key: 'total' as PeriodFilter, label: 'Total' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                periodFilter === key
                  ? 'bg-(--text-primary) text-(--bg-color)'
                  : 'bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color)'
              }`}
              style={periodFilter !== key ? { color: 'var(--text-primary)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Seletor de Mês/Ano para filtro específico */}
      {periodFilter === 'mes_especifico' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 w-full max-w-full">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="w-4 h-4 opacity-70" />
            <span className="text-sm font-medium opacity-80">Selecionar Período:</span>
          </div>
          <div className="flex flex-wrap gap-2 min-w-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-sm bg-(--glass-bg) border border-(--border-color) text-(--text-primary)"
            >
              {[
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
              ].map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-sm bg-(--glass-bg) border border-(--border-color) text-(--text-primary)"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full max-w-full">
        <div className="premium-glass rounded-xl p-4 border border-(--border-color)">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <ArrowUpCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs opacity-70 font-medium">Receita Total</p>
              <p className="text-lg font-bold">R$ {metrics.totalReceitaComManual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              {isManagerRole && metrics.receitasManuais > 0 && (
                <p className="text-xs opacity-60">
                  Boletos: R$ {metrics.totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <br />
                  Manual: R$ {metrics.receitasManuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="premium-glass rounded-xl p-4 border border-(--border-color)">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/20">
              <ArrowDownCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs opacity-70 font-medium">Despesa Total</p>
              <p className="text-lg font-bold">R$ {metrics.totalDespesaComManual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              {isManagerRole && metrics.despesasManuais > 0 && (
                <p className="text-xs opacity-60">
                  Boletos: R$ {metrics.totalDespesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <br />
                  Manual: R$ {metrics.despesasManuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className={`premium-glass rounded-xl p-4 border border-(--border-color) ${
          metrics.saldoAtualComManual >= 0 ? 'border-green-500/30' : 'border-red-500/30'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${
              metrics.saldoAtualComManual >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              <DollarSign className={`w-5 h-5 ${
                metrics.saldoAtualComManual >= 0 ? 'text-green-400' : 'text-red-400'
              }`} />
            </div>
            <div>
              <p className="text-xs opacity-70 font-medium">Saldo Atual</p>
              <p className={`text-lg font-bold ${
                metrics.saldoAtualComManual >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                R$ {metrics.saldoAtualComManual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {isManagerRole && (metrics.receitasManuais > 0 || metrics.despesasManuais > 0) && (
                <p className="text-xs opacity-60">
                  Sem manual: R$ {metrics.saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="premium-glass rounded-xl p-4 border border-(--border-color)">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Receipt className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs opacity-70 font-medium">Boletos Pagos</p>
              <p className="text-lg font-bold">{metrics.boletosPagos}</p>
            </div>
           </div>
        </div>
      </div>

      {/* Status dos Boletos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="premium-glass rounded-xl p-4 border border-(--border-color)">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pagos</span>
            <span className="text-lg font-bold text-green-400">{metrics.boletosPagos}</span>
          </div>
          <div className="w-full bg-(--glass-bg) rounded-full h-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.boletosPagos > 0 ? (metrics.boletosPagos / (metrics.boletosPagos + metrics.boletosPendentes + metrics.boletosVencidos)) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="premium-glass rounded-xl p-4 border border-(--border-color)">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pendentes</span>
            <span className="text-lg font-bold text-yellow-400">{metrics.boletosPendentes}</span>
          </div>
          <div className="w-full bg-(--glass-bg) rounded-full h-2">
            <div
              className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.boletosPendentes > 0 ? (metrics.boletosPendentes / (metrics.boletosPagos + metrics.boletosPendentes + metrics.boletosVencidos)) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="premium-glass rounded-xl p-4 border border-(--border-color)">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Vencidos</span>
            <span className="text-lg font-bold text-red-400">{metrics.boletosVencidos}</span>
          </div>
          <div className="w-full bg-(--glass-bg) rounded-full h-2">
            <div
              className="bg-red-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.boletosVencidos > 0 ? (metrics.boletosVencidos / (metrics.boletosPagos + metrics.boletosPendentes + metrics.boletosVencidos)) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Receitas por Tipo */}
      <div className="premium-glass rounded-2xl p-6 border border-(--border-color) mb-8">
        <div className="flex items-center gap-3 mb-6">
          <PieChart className="w-5 h-5" />
          <h3 className="text-lg font-black uppercase tracking-tight">Receitas por Tipo</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              R$ {metrics.receitaPorTipo.condominio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm opacity-70">Condomínio</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400 mb-1">
              R$ {metrics.receitaPorTipo.agua.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm opacity-70">Água</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              R$ {metrics.receitaPorTipo.luz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm opacity-70">Luz</div>
          </div>
        </div>
      </div>

      {/* Entradas Manuais (apenas para Síndico) */}
      {isManagerRole && (
        <div className="premium-glass rounded-2xl p-6 border border-(--border-color) mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5" />
              <h3 className="text-lg font-black uppercase tracking-tight">Entradas Manuais</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsReceitaModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Receita
              </button>
              <button
                onClick={() => setIsDespesaModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Despesa
              </button>
            </div>
          </div>

          {/* Totais das Entradas Manuais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-green-400/10 border border-green-400/20">
              <div className="text-lg font-bold text-green-400 mb-1">
                +R$ {metrics.receitasManuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm opacity-70">Receitas Manuais</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-400/10 border border-red-400/20">
              <div className="text-lg font-bold text-red-400 mb-1">
                -R$ {metrics.despesasManuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm opacity-70">Despesas Manuais</div>
            </div>
            <div className={`text-center p-4 rounded-lg border ${
              metrics.receitasManuais - metrics.despesasManuais >= 0
                ? 'bg-green-400/10 border-green-400/20'
                : 'bg-red-400/10 border-red-400/20'
            }`}>
              <div className={`text-lg font-bold mb-1 ${
                metrics.receitasManuais - metrics.despesasManuais >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {metrics.receitasManuais - metrics.despesasManuais >= 0 ? '+' : ''}
                R$ {(metrics.receitasManuais - metrics.despesasManuais).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm opacity-70">Saldo Manual</div>
            </div>
          </div>

          {/* Lista de Entradas */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wide opacity-80">Últimas Entradas</h4>
            {loadingEntries ? (
              <div className="text-center py-4 opacity-70">Carregando...</div>
            ) : financialEntries.length === 0 ? (
              <div className="text-center py-8 opacity-70">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma entrada manual registrada</p>
                <p className="text-sm">Use os botões acima para adicionar receitas ou despesas</p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {financialEntries.slice(0, 10).map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-(--glass-bg) border border-(--border-color)"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          entry.type === 'receita'
                            ? 'bg-green-400/20 text-green-400'
                            : 'bg-red-400/20 text-red-400'
                        }`}>
                          {entry.category}
                        </span>
                        <span className="text-xs opacity-70">
                          {new Date(entry.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm">{entry.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${
                        entry.type === 'receita' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.type === 'receita' ? '+' : '-'}
                        R$ {entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="p-1 rounded hover:bg-(--border-color) transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 rounded hover:bg-red-400/20 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {financialEntries.length > 10 && (
                  <div className="text-center text-sm opacity-70 py-2">
                    Mostrando as 10 últimas entradas
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo por Residente (apenas para Síndico) */}
      {isManagerRole && (
        <div className="premium-glass rounded-2xl p-6 border border-(--border-color) mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <h3 className="text-lg font-black uppercase tracking-tight">Resumo por Residente</h3>
            </div>
            <div className="text-sm opacity-70">
              {allResidents.length} moradores cadastrados
            </div>
          </div>

          {/* Estatísticas rápidas dos residentes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {(() => {
              const residentStats = allResidents.map(resident => {
                const residentBoletos = allBoletos.filter(b =>
                  b.residentName === resident.name && b.unit === resident.unit
                );
                const totalPago = residentBoletos
                  .filter(b => b.status === 'Pago')
                  .reduce((sum, b) => sum + b.amount, 0);
                const boletosPagos = residentBoletos.filter(b => b.status === 'Pago').length;
                const boletosPendentes = residentBoletos.filter(b => b.status === 'Pendente').length;
                const boletosVencidos = residentBoletos.filter(b => b.status === 'Vencido').length;

                return {
                  ...resident,
                  totalPago,
                  boletosPagos,
                  boletosPendentes,
                  boletosVencidos,
                  status: boletosPendentes === 0 && boletosVencidos === 0 ? 'em_dia' : 'pendente'
                };
              });

              const emDia = residentStats.filter(r => r.status === 'em_dia').length;
              const pendentes = residentStats.filter(r => r.status === 'pendente').length;
              const totalPagoGeral = residentStats.reduce((sum, r) => sum + r.totalPago, 0);

              return [
                {
                  label: 'Em Dia',
                  value: emDia,
                  color: 'text-green-400',
                  bgColor: 'bg-green-400/20'
                },
                {
                  label: 'Com Pendências',
                  value: pendentes,
                  color: 'text-red-400',
                  bgColor: 'bg-red-400/20'
                },
                {
                  label: 'Total Recebido',
                  value: `R$ ${totalPagoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  color: 'text-blue-400',
                  bgColor: 'bg-blue-400/20'
                },
                {
                  label: 'Taxa de Aderência',
                  value: `${allResidents.length > 0 ? Math.round((emDia / allResidents.length) * 100) : 0}%`,
                  color: 'text-purple-400',
                  bgColor: 'bg-purple-400/20'
                }
              ].map((stat, index) => (
                <div key={index} className={`text-center p-3 rounded-lg ${stat.bgColor}`}>
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs opacity-70">{stat.label}</div>
                </div>
              ));
            })()}
          </div>

          <div className="overflow-x-auto w-full max-w-full rounded-xl border border-(--border-color)/30">
            <table className="w-full min-w-[640px] max-w-full border-collapse">
              <thead>
                <tr className="border-b border-(--border-color)">
                  <th className="text-left py-3 px-2 font-medium opacity-70">Residente</th>
                  <th className="text-left py-3 px-2 font-medium opacity-70">Unidade</th>
                  <th className="text-right py-3 px-2 font-medium opacity-70">Valor Pago</th>
                  <th className="text-right py-3 px-2 font-medium opacity-70">Pagos</th>
                  <th className="text-right py-3 px-2 font-medium opacity-70">Pendentes</th>
                  <th className="text-right py-3 px-2 font-medium opacity-70">Vencidos</th>
                  <th className="text-right py-3 px-2 font-medium opacity-70">Status</th>
                </tr>
              </thead>
              <tbody>
                {allResidents
                  .map(resident => {
                    const residentBoletos = allBoletos.filter(b =>
                      b.residentName === resident.name && b.unit === resident.unit
                    );
                    const totalPago = residentBoletos
                      .filter(b => b.status === 'Pago')
                      .reduce((sum, b) => sum + b.amount, 0);
                    const boletosPagos = residentBoletos.filter(b => b.status === 'Pago').length;
                    const boletosPendentes = residentBoletos.filter(b => b.status === 'Pendente').length;
                    const boletosVencidos = residentBoletos.filter(b => b.status === 'Vencido').length;

                    return {
                      ...resident,
                      totalPago,
                      boletosPagos,
                      boletosPendentes,
                      boletosVencidos,
                      status: boletosPendentes === 0 && boletosVencidos === 0 ? 'em_dia' : 'pendente'
                    };
                  })
                  .sort((a, b) => b.totalPago - a.totalPago) // Ordenar por valor pago (maior primeiro)
                  .slice(0, 20) // Mostrar top 20
                  .map(resident => (
                    <tr key={resident.id} className="border-b border-(--border-color)/30 hover:bg-(--glass-bg)/30 transition-colors">
                      <td className="py-3 px-2 font-medium">{resident.name}</td>
                      <td className="py-3 px-2 opacity-70">{resident.unit}</td>
                      <td className="py-3 px-2 text-right font-medium text-green-400">
                        R$ {resident.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-green-400 font-medium">{resident.boletosPagos}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-yellow-400 font-medium">{resident.boletosPendentes}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-red-400 font-medium">{resident.boletosVencidos}</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {resident.status === 'em_dia' ? (
                          <span className="text-green-400 text-xs px-2 py-1 rounded-full bg-green-400/20">Em dia</span>
                        ) : (
                          <span className="text-red-400 text-xs px-2 py-1 rounded-full bg-red-400/20">Pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {allResidents.length > 20 && (
            <div className="text-center mt-4">
              <span className="text-sm opacity-70">
                Mostrando os 20 residentes com maiores pagamentos. Total: {allResidents.length} moradores.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Gráficos e Visualizações */}
      <div className="premium-glass rounded-2xl p-6 border border-(--border-color) mb-8">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-5 h-5" />
          <h3 className="text-lg font-black uppercase tracking-tight">Gráficos e Tendências</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gráfico de Receitas vs Despesas por Mês */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide mb-4 opacity-80">Receitas vs Despesas (Últimos 6 meses)</h4>
            <div className="space-y-3">
              {(() => {
                const monthlyData = allBoletos.reduce((acc, boleto) => {
                  const date = new Date(boleto.dueDate);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

                  if (!acc[monthKey]) {
                    acc[monthKey] = {
                      monthName,
                      receita: 0,
                      despesa: 0,
                      order: date.getTime()
                    };
                  }

                  if (boleto.status === 'Pago') {
                    acc[monthKey].receita += boleto.amount;
                    acc[monthKey].despesa += boleto.amount;
                  }

                  return acc;
                }, {} as Record<string, { monthName: string; receita: number; despesa: number; order: number }>);

                const last6Months = Object.entries(monthlyData)
                  .sort(([,a], [,b]) => b.order - a.order)
                  .slice(0, 6)
                  .reverse();

                const maxValue = Math.max(...last6Months.flatMap(([, data]) => [data.receita, data.despesa]));

                return last6Months.map(([month, data]) => (
                  <div key={month} className="flex items-center gap-4">
                    <div className="w-12 text-xs opacity-70 font-medium">{data.monthName}</div>
                    <div className="flex-1 flex gap-1">
                      <div className="flex-1 bg-green-400/20 rounded-sm relative overflow-hidden"
                           style={{ height: '24px' }}>
                        <div
                          className="bg-green-400 rounded-sm transition-all duration-500"
                          style={{
                            height: '100%',
                            width: `${maxValue > 0 ? (data.receita / maxValue) * 100 : 0}%`
                          }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-start px-2">
                          <span className="text-xs font-medium text-green-400">
                            R$ {data.receita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 bg-red-400/20 rounded-sm relative overflow-hidden"
                           style={{ height: '24px' }}>
                        <div
                          className="bg-red-400 rounded-sm transition-all duration-500"
                          style={{
                            height: '100%',
                            width: `${maxValue > 0 ? (data.despesa / maxValue) * 100 : 0}%`
                          }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-end px-2">
                          <span className="text-xs font-medium text-red-400">
                            R$ {data.despesa.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded"></div>
                <span className="text-xs opacity-70">Receitas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded"></div>
                <span className="text-xs opacity-70">Despesas</span>
              </div>
            </div>
          </div>

          {/* Gráfico de Distribuição por Tipo */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide mb-4 opacity-80">Distribuição por Tipo de Boleto</h4>
            <div className="space-y-4">
              {(() => {
                const tipos = [
                  { key: 'condominio', label: 'Condomínio', color: 'bg-blue-400' },
                  { key: 'agua', label: 'Água', color: 'bg-cyan-400' },
                  { key: 'luz', label: 'Luz', color: 'bg-yellow-400' }
                ] as const;

                const totalGeral = Object.values(metrics.receitaPorTipo).reduce((sum, val) => sum + val, 0);

                return tipos.map(({ key, label, color }) => {
                  const valor = metrics.receitaPorTipo[key];
                  const percentual = totalGeral > 0 ? (valor / totalGeral) * 100 : 0;

                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-sm opacity-70">
                          R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({percentual.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-(--glass-bg) rounded-full h-3 overflow-hidden">
                        <div
                          className={`${color} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${percentual}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Status dos Boletos - Gráfico de Pizza Simples */}
            <div className="mt-8">
              <h4 className="text-sm font-bold uppercase tracking-wide mb-4 opacity-80">Status dos Boletos</h4>
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    {(() => {
                      const total = metrics.boletosPagos + metrics.boletosPendentes + metrics.boletosVencidos;
                      if (total === 0) return null;

                      let currentAngle = 0;
                      const segments = [
                        { value: metrics.boletosPagos, color: '#10b981', label: 'Pagos' },
                        { value: metrics.boletosPendentes, color: '#f59e0b', label: 'Pendentes' },
                        { value: metrics.boletosVencidos, color: '#ef4444', label: 'Vencidos' }
                      ].filter(segment => segment.value > 0);

                      return segments.map((segment, index) => {
                        const percentage = (segment.value / total) * 100;
                        const angle = (percentage / 100) * 360;
                        const startAngle = currentAngle;
                        currentAngle += angle;

                        const x1 = 18 + 18 * Math.cos((startAngle * Math.PI) / 180);
                        const y1 = 18 + 18 * Math.sin((startAngle * Math.PI) / 180);
                        const x2 = 18 + 18 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                        const y2 = 18 + 18 * Math.sin(((startAngle + angle) * Math.PI) / 180);

                        const largeArcFlag = angle > 180 ? 1 : 0;

                        return (
                          <path
                            key={index}
                            d={`M 18 18 L ${x1} ${y1} A 18 18 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={segment.color}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold opacity-70">
                      {metrics.boletosPagos + metrics.boletosPendentes + metrics.boletosVencidos}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded"></div>
                  <span className="text-xs opacity-70">Pagos ({metrics.boletosPagos})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                  <span className="text-xs opacity-70">Pendentes ({metrics.boletosPendentes})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded"></div>
                  <span className="text-xs opacity-70">Vencidos ({metrics.boletosVencidos})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quebra Mensal */}
      <div className="premium-glass rounded-2xl p-6 border border-(--border-color) mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-5 h-5" />
          <h3 className="text-lg font-black uppercase tracking-tight">Quebra por Mês</h3>
        </div>
        <div className="overflow-x-auto w-full max-w-full rounded-xl border border-(--border-color)/30">
          <table className="w-full min-w-[320px] max-w-full border-collapse">
            <thead>
              <tr className="border-b border-(--border-color)">
                <th className="text-left py-3 px-2 font-medium opacity-70">Mês</th>
                <th className="text-right py-3 px-2 font-medium opacity-70">Receita</th>
                <th className="text-right py-3 px-2 font-medium opacity-70">Despesa</th>
                <th className="text-right py-3 px-2 font-medium opacity-70">Saldo</th>
                <th className="text-right py-3 px-2 font-medium opacity-70">Boletos</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Agrupar boletos por mês
                const monthlyData = allBoletos.reduce((acc, boleto) => {
                  const date = new Date(boleto.dueDate);
                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const monthName = date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });

                  if (!acc[monthKey]) {
                    acc[monthKey] = {
                      monthName,
                      receita: 0,
                      despesa: 0,
                      boletos: 0,
                      order: date.getTime()
                    };
                  }

                  if (boleto.status === 'Pago') {
                    acc[monthKey].receita += boleto.amount;
                    acc[monthKey].despesa += boleto.amount; // Simplificado
                  }
                  acc[monthKey].boletos += 1;

                  return acc;
                }, {} as Record<string, { monthName: string; receita: number; despesa: number; boletos: number; order: number }>);

                // Ordenar por data (mais recente primeiro) e pegar os últimos 12 meses
                return Object.entries(monthlyData)
                  .sort(([,a], [,b]) => b.order - a.order)
                  .slice(0, 12)
                  .map(([, data]) => {
                    const saldo = data.receita - data.despesa;
                    return (
                      <tr key={data.monthName} className="border-b border-(--border-color)/30 hover:bg-(--glass-bg)/30 transition-colors">
                        <td className="py-3 px-2 font-medium">{data.monthName}</td>
                        <td className="py-3 px-2 text-right text-green-400 font-medium">
                          R$ {data.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-right text-red-400 font-medium">
                          R$ {data.despesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-3 px-2 text-right font-medium ${
                          saldo >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-right font-medium">{data.boletos}</td>
                      </tr>
                    );
                  });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3 sm:gap-4 w-full max-w-full">
        <button
          onClick={exportFinancialReport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          <Download className="w-4 h-4" />
          Exportar Relatório
        </button>
        <button
          onClick={() => setIsDetailedChartsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-(--glass-bg) border border-(--border-color) hover:bg-(--border-color) transition-all text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          <BarChart3 className="w-4 h-4" />
          Ver Gráficos Detalhados
        </button>
      </div>

      {/* Modal de Gráficos Detalhados */}
      <DetailedChartsModal
        isOpen={isDetailedChartsOpen}
        onClose={() => setIsDetailedChartsOpen(false)}
        allBoletos={allBoletos}
        periodFilter={periodFilter}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Modais de Entradas Manuais */}
      <FinancialEntryModal
        isOpen={isReceitaModalOpen}
        onClose={closeEntryModals}
        onSave={handleSaveEntry}
        type="receita"
        editEntry={editingEntry?.type === 'receita' ? editingEntry : null}
      />

      <FinancialEntryModal
        isOpen={isDespesaModalOpen}
        onClose={closeEntryModals}
        onSave={handleSaveEntry}
        type="despesa"
        editEntry={editingEntry?.type === 'despesa' ? editingEntry : null}
      />

      {/* File picker oculto também disponível na aba Balancete */}
      <input
        ref={importPdfPickerRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []).filter(Boolean);
          try {
            e.currentTarget.value = '';
          } catch {}
          if (files.length > 0) {
            console.log('[FinanceiroView] PDFs selecionados no file picker:', files.length);
            runPdfImport(files);
          }
        }}
      />
    </div>
  );
};

export default FinanceiroView;