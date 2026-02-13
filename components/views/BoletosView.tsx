
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  DollarSign,
  Download,
  Droplets,
  Eye,
  FileText,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
  Zap
} from 'lucide-react';
import { Boleto, BoletoType, Resident } from '../../types';
import { formatUnit, compareUnits } from '../../utils/unitFormatter';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { downloadBoletoOriginalPdf } from '../../services/dataService';
import { useToast } from '../../contexts/ToastContext';

const BOLETO_TYPE_LABELS: Record<BoletoType, string> = {
  condominio: 'Taxa/Condomínio',
  agua: 'Água',
  luz: 'Luz'
};

const BOLETO_TYPE_ICONS: Record<BoletoType, React.ReactNode> = {
  condominio: <Building2 className="w-4 h-4" />,
  agua: <Droplets className="w-4 h-4" />,
  luz: <Zap className="w-4 h-4" />
};

interface BoletosViewProps {
  allBoletos: Boleto[];
  boletoSearch: string;
  setBoletoSearch: (val: string) => void;
  allResidents: Resident[];
  onViewBoleto?: (boleto: Boleto) => void;
  onDownloadBoleto?: (boleto: Boleto) => void;
  onDeleteBoleto?: (boleto: Boleto) => void;
  showImportButton?: boolean;
  isResidentView?: boolean;
  currentResident?: Resident | null; // Para filtrar boletos do morador logado
  isLoading?: boolean;
  role?: 'MORADOR' | 'PORTEIRO' | 'SINDICO';
  onImportBoletos?: () => void; // Callback para abrir modal de importação
  onImportPdfsSelected?: (files: File[]) => void; // PDFs selecionados no file picker do SO
}

const BoletosView: React.FC<BoletosViewProps> = ({
  allBoletos,
  boletoSearch,
  setBoletoSearch,
  allResidents,
  onViewBoleto,
  onDownloadBoleto,
  onDeleteBoleto,
  showImportButton = true,
  isResidentView = false,
  currentResident = null,
  isLoading = false,
  role,
  onImportBoletos,
  onImportPdfsSelected
}) => {
  const { config } = useAppConfig();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Pago' | 'Vencido'>('all');
  const [typeFilter, setTypeFilter] = useState<BoletoType | 'all'>('all');
  const [selectedBoleto, setSelectedBoleto] = useState<Boleto | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Verificar se estamos no lado do cliente
  const isClient = typeof window !== 'undefined';

  // Monitor simples de localização (não interfere com navegação)
  useEffect(() => {
    if (!isClient) return;

    // Apenas log de localização inicial para debug
    console.log('[BoletosView] Componente montado na rota:', window.location.pathname);

    // Listener simples para mudanças de rota (não interfere)
    const handleLocationChange = () => {
      console.log('[BoletosView] Mudança de localização detectada:', window.location.pathname);
    };

    // Usar MutationObserver para detectar mudanças no pathname
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== '/financeiro') {
        console.warn('[BoletosView] Localização mudou para rota diferente:', window.location.pathname);
      }
    });

    // Observar mudanças no elemento que contém o pathname
    if (document.querySelector('[data-pathname]')) {
      observer.observe(document.querySelector('[data-pathname]')!, {
        attributes: true,
        attributeFilter: ['data-pathname']
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [isClient]);

  // Função ISOLADA para importar boletos - NÃO deve causar nenhum side-effect
  const handleImportClick = useCallback((e?: React.MouseEvent) => {
    console.log('[BoletosView] ======= INÍCIO handleImportClick (ISOLADO) =======');
    console.log('[BoletosView] Timestamp:', Date.now());
    console.log('[BoletosView] Event:', e);
    console.log('[BoletosView] Role:', role);
    console.log('[BoletosView] Current location:', window?.location?.pathname);

    // CRÍTICO: Prevenir QUALQUER propagação ou comportamento padrão
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      // stopImmediatePropagation não existe no tipo do SyntheticEvent do React; usar nativeEvent com cast seguro
      try {
        (e.nativeEvent as any)?.stopImmediatePropagation?.();
      } catch {
        // ignore
      }
      console.log('[BoletosView] Evento completamente prevenido');
    }

    // Verificar ambiente - apenas client-side
    if (typeof window === 'undefined') {
      console.log('[BoletosView] Ambiente não é client-side');
      return;
    }

    // Verificar permissões - apenas administradores
    if (role === 'MORADOR') {
      console.log('[BoletosView] Acesso negado: usuário MORADOR');
      toast.error('Acesso restrito. Apenas síndicos e porteiros podem importar boletos.');
      return;
    }

    console.log('[BoletosView] Usuário autorizado, abrindo modal de importação');

    // Abrir modal de importação (abrir modal NÃO é importação)
    if (onImportBoletos) {
      onImportBoletos();
      console.log('[BoletosView] Modal de importação aberto com sucesso');
    } else {
      console.warn('[BoletosView] Callback onImportBoletos não fornecido');
      toast.error('Funcionalidade de importação não disponível no momento.');
      return;
    }

    console.log('[BoletosView] ======= FIM handleImportClick (MODAL ABERTO) =======');
  }, [role, toast, onImportBoletos]);

  // Filtrar boletos do morador logado quando for vista de morador
  const residentBoletos = useMemo(() => {
    if (!isResidentView || !currentResident) return allBoletos;
    // Regra: morador deve ver boletos associados ao seu morador_id (resident_id).
    // Fallback: para boletos antigos sem resident_id, usa comparação por unidade.
    return allBoletos.filter((boleto) => {
      if (boleto.resident_id && currentResident.id) {
        return boleto.resident_id === currentResident.id;
      }
      return compareUnits(boleto.unit, currentResident.unit);
    });
  }, [allBoletos, isResidentView, currentResident]);

  // Usar os boletos filtrados para moradores, ou todos para administradores
  const boletosToShow = isResidentView ? residentBoletos : allBoletos;

  // Funções de filtro otimizadas com useCallback
  const filterByType = useCallback((boletos: Boleto[]) => {
    if (typeFilter === 'all') return boletos;
    return boletos.filter(b => (b.boletoType || 'condominio') === typeFilter);
  }, [typeFilter]);

  const filterBySearch = useCallback((boletos: Boleto[]) => {
    if (!boletoSearch) return boletos;
    const searchLower = boletoSearch.toLowerCase();
    return boletos.filter(b =>
      b.residentName.toLowerCase().includes(searchLower) ||
      b.unit.toLowerCase().includes(searchLower) ||
      b.referenceMonth.toLowerCase().includes(searchLower)
    );
  }, [boletoSearch]);

  const filterByStatus = useCallback((boletos: Boleto[]) => {
    if (statusFilter === 'all') return boletos;
    return boletos.filter(b => b.status === statusFilter);
  }, [statusFilter]);

  const sortBoletos = useCallback((boletos: Boleto[]) => {
    return [...boletos].sort((a, b) => {
      const statusOrder = { 'Vencido': 0, 'Pendente': 1, 'Pago': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });
  }, []);

  const filteredBoletos = useMemo(() => {
    // Aplicar filtros em sequência
    let filtered = boletosToShow;
    filtered = filterByType(filtered);
    filtered = filterBySearch(filtered);
    filtered = filterByStatus(filtered);
    return sortBoletos(filtered);
  }, [boletosToShow, filterByType, filterBySearch, filterByStatus, sortBoletos]);

  const getStatusIcon = (status: Boleto['status']) => {
    switch (status) {
      case 'Pago':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'Vencido':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'Pendente':
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: Boleto['status']) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider";
    switch (status) {
      case 'Pago':
        return `${baseClasses} bg-green-500/20 text-green-400 border border-green-500/30`;
      case 'Vencido':
        return `${baseClasses} bg-red-500/20 text-red-400 border border-red-500/30`;
      case 'Pendente':
        return `${baseClasses} bg-amber-500/20 text-amber-400 border border-amber-500/30`;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatBarcodeDisplay = (barcode?: string) => {
    const raw = (barcode || '').replace(/\s+/g, '').trim();
    if (!raw) return '';
    if (raw.length <= 24) return raw;
    const mid = Math.ceil(raw.length / 2);
    return `${raw.slice(0, mid)}\n${raw.slice(mid)}`;
  };

  type CompositionItem = { label: string; amount?: number };

  const parseCompositionFromDescription = (description?: string): CompositionItem[] => {
    const desc = (description || '').trim();
    if (!desc) return [];
    const parts = desc
      .split(/\r?\n|;|\|/g)
      .map((p) => p.trim())
      .filter(Boolean);

    const items: CompositionItem[] = [];
    for (const p of parts) {
      const m1 = p.match(/^(.*?)(?:\s*[-–]\s*)R\$\s*([\d.,]+)\s*$/i);
      const m2 = p.match(/^(.*?)(?:\s*[-–]\s*)([\d.,]+)\s*$/i);
      const pick = m1 || m2;
      if (pick) {
        const label = (pick[1] || '').trim();
        const amountRaw = (pick[2] || '').trim();
        const amount = Number(amountRaw.replace(/\./g, '').replace(',', '.'));
        if (label) {
          items.push({ label, amount: Number.isFinite(amount) ? amount : undefined });
          continue;
        }
      }
      items.push({ label: p });
    }
    return items;
  };

  const buildComposition = (boleto: Boleto): CompositionItem[] => {
    const baseLabel =
      boleto.boletoType === 'agua'
        ? `Conta de Água - ${boleto.referenceMonth}`
        : boleto.boletoType === 'luz'
          ? `Conta de Luz - ${boleto.referenceMonth}`
          : `Taxa de Condomínio - ${boleto.referenceMonth}`;

    const parsed = parseCompositionFromDescription(boleto.description);
    const parsedWithAmount = parsed.filter((i) => typeof i.amount === 'number' && Number.isFinite(i.amount));
    const sumParsed = parsedWithAmount.reduce((acc, it) => acc + (it.amount || 0), 0);

    if (parsedWithAmount.length >= 1 && sumParsed > 0 && sumParsed <= boleto.amount) {
      const remaining = boleto.amount - sumParsed;
      if (remaining > 0.009) return [{ label: baseLabel, amount: remaining }, ...parsed];
      return parsed;
    }

    const notes = parsed.filter((i) => i.label && !i.amount);
    return [{ label: baseLabel, amount: boleto.amount }, ...notes];
  };

  const statusLabel = (status: Boleto['status']) => {
    if (status === 'Pago') return 'Pago';
    if (status === 'Vencido') return 'Vencido';
    return 'Pendente';
  };

  const statusPillClasses = (status: Boleto['status']) => {
    const base = 'px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider';
    if (status === 'Pago') return `${base} bg-green-500/20 text-green-400 border border-green-500/30`;
    if (status === 'Vencido') return `${base} bg-red-500/20 text-red-400 border border-red-500/30`;
    return `${base} bg-amber-500/20 text-amber-400 border border-amber-500/30`;
  };

  const copyToClipboard = async (text: string) => {
    const value = (text || '').trim();
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      return true;
    } catch {
      return false;
    }
  };


  const handleShareBoleto = async (boleto: Boleto) => {
    const shareText = `🏢 BOLETO - ${config.condominiumName?.toUpperCase() || 'CONDOMÍNIO'}\n\n📍 Unidade: ${formatUnit(boleto.unit)}\n📅 Referência: ${boleto.referenceMonth}\n💰 Valor: ${formatCurrency(boleto.amount)}\n📆 Vencimento: ${formatDate(boleto.dueDate)}\n📊 Status: ${boleto.status}`;
    const barcode = (boleto.barcode || '').trim();
    const fullText = barcode ? `${shareText}\n\n📋 Código de barras:\n${barcode}` : shareText;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Boleto',
          text: fullText,
          url: boleto.pdfUrl || undefined
        });
        return;
      }
    } catch {
      // ignore
    }

    // Fallback: tentar abrir WhatsApp se for mobile
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
      window.open(whatsappUrl, '_blank');
      return;
    }

    // Último fallback: copiar para clipboard
    await copyToClipboard(fullText);
  };

  const calculateStats = useCallback((boletos: Boleto[]) => {
    const total = boletos.length;
    const pendentes = boletos.filter(b => b.status === 'Pendente').length;
    const pagos = boletos.filter(b => b.status === 'Pago').length;
    const vencidos = boletos.filter(b => b.status === 'Vencido').length;
    const totalAmount = boletos.reduce((sum, b) => sum + b.amount, 0);
    const pendenteAmount = boletos
      .filter(b => b.status === 'Pendente' || b.status === 'Vencido')
      .reduce((sum, b) => sum + b.amount, 0);

    return { total, pendentes, pagos, vencidos, totalAmount, pendenteAmount };
  }, []);

  const stats = useMemo(() => {
    const filteredForType = typeFilter === 'all' ? boletosToShow : boletosToShow.filter(b => (b.boletoType || 'condominio') === typeFilter);
    return calculateStats(filteredForType);
  }, [boletosToShow, typeFilter, calculateStats]);

  // Versão simplificada para moradores
  if (isResidentView) {
    const toRefTime = (ref: string, fallbackDue?: string) => {
      const raw = (ref || '').trim();
      const mmYyyy = raw.match(/^(\d{2})\/(\d{4})$/);
      if (mmYyyy) {
        const month = Number(mmYyyy[1]);
        const year = Number(mmYyyy[2]);
        const d = new Date(year, Math.max(0, month - 1), 1);
        return d.getTime();
      }
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) return t;
      const dueT = fallbackDue ? Date.parse(fallbackDue) : NaN;
      return Number.isNaN(dueT) ? 0 : dueT;
    };

    const sortedBoletos = [...boletosToShow].sort((a, b) => {
      // Ordenar por referência (mais recente primeiro); fallback para vencimento
      return toRefTime(b.referenceMonth, b.dueDate) - toRefTime(a.referenceMonth, a.dueDate);
    });

    const handleQuickDownload = async (boleto: Boleto) => {
      try {
        let downloadUrl = '';
        const fileName = `boleto_${String(boleto.referenceMonth || '').replace('/', '_')}_${formatUnit(boleto.unit).replace('/', '_')}.pdf`;

        if (boleto.pdf_original_path) {
          const result = await downloadBoletoOriginalPdf(boleto.pdf_original_path, boleto.checksum_pdf);
          if (!result.url) {
            toast.error(result.error || 'Erro ao baixar PDF original.');
            return;
          }
          downloadUrl = result.url;
        } else if (boleto.pdfUrl) {
          downloadUrl = boleto.pdfUrl;
        } else {
          toast.error('Este boleto não possui PDF disponível.');
          return;
        }

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (downloadUrl.startsWith('blob:')) {
          URL.revokeObjectURL(downloadUrl);
        }
      } catch (e) {
        console.error('[BoletosView] Erro ao baixar boleto:', e);
        toast.error('Erro ao baixar o boleto.');
      } finally {
        if (onDownloadBoleto) onDownloadBoleto(boleto);
      }
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <header>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Boletos</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Condomínio, Água e Luz</p>
        </header>

        {sortedBoletos.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
            <FileText className="w-16 h-16 opacity-20" />
            <h3 className="text-xl font-black uppercase tracking-tight opacity-40">
              Nenhum boleto disponível
            </h3>
            <p className="text-sm opacity-30 text-center max-w-md">
              Seus boletos aparecerão aqui quando estiverem disponíveis
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedBoletos.map((boleto) => (
              <div
                key={boleto.id}
                className="relative premium-glass rounded-2xl p-6 border border-[var(--border-color)] hover:border-[var(--text-primary)]/30 transition-all group"
              >
                {/* Ação rápida: baixar PDF (obrigatório para morador) */}
                {(boleto.pdf_original_path || boleto.pdfUrl) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleQuickDownload(boleto);
                    }}
                    className="absolute top-3 right-3 px-3 py-2 rounded-xl bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all opacity-90"
                    style={{ color: 'var(--text-primary)' }}
                    title="Baixar boleto (PDF original)"
                  >
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <Download className="w-4 h-4" />
                      Baixar
                    </span>
                  </button>
                )}
                {/* Botão de exclusão no canto superior direito - apenas para administradores */}
                {!isResidentView && onDeleteBoleto && (
                  <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Tem certeza que deseja excluir o boleto de ${boleto.referenceMonth}?`)) {
                      if (onDeleteBoleto) {
                        onDeleteBoleto(boleto);
                      } else {
                        alert('Função de exclusão não disponível. Entre em contato com a administração.');
                      }
                    }
                  }}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 transition-all opacity-70 group-hover:opacity-100"
                  title="Excluir Boleto"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
                )}

                <button
                  onClick={() => setSelectedBoleto(boleto)}
                  className="w-full text-left"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Taxa de Condomínio</p>
                        <p className="text-sm font-bold opacity-80">{BOLETO_TYPE_LABELS[boleto.boletoType || 'condominio']}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Status</p>
                        <span className={statusPillClasses(boleto.status)}>
                          {statusLabel(boleto.status)}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Valor $</p>
                        <p className="text-lg font-black">{formatCurrency(boleto.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Vencimento</p>
                        <p className="text-sm font-bold opacity-80">{formatDate(boleto.dueDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Referência</p>
                        <p className="text-sm font-bold opacity-80">{boleto.referenceMonth}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest opacity-50">Unidade</p>
                        <p className="text-sm font-bold opacity-80">{formatUnit(boleto.unit)}</p>
                      </div>
                    </div>
                    <div className="text-center pt-2 border-t border-[var(--border-color)]">
                      <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Toque para detalhes</p>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Detalhes do boleto (padrão das imagens) */}
        {selectedBoleto && (
          <div className="fixed inset-0 z-[200] bg-[var(--bg-color)]">
            <div className="h-full overflow-y-auto custom-scrollbar">
              <div className="max-w-xl mx-auto px-4 py-6">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setSelectedBoleto(null)}
                    className="p-2 rounded-xl hover:bg-white/10 transition-all"
                    aria-label="Voltar"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <h3 className="text-lg font-black uppercase tracking-tight">Detalhes do boleto</h3>
                </div>

                <div className="text-center mb-6">
                  <p className="text-xs font-black uppercase tracking-widest opacity-50">
                    {(config.condominiumName || 'Condomínio').toUpperCase()}
                  </p>
                  <p className="text-2xl font-black tracking-tight mt-1">
                    {formatUnit(selectedBoleto.unit).replace('/', ' / ')}
                  </p>
                </div>

                <div className="premium-glass rounded-2xl p-6 border border-[var(--border-color)]">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <h4 className="text-sm font-black uppercase tracking-wider opacity-70">Composição de arrecadação</h4>
                    <span className={statusPillClasses(selectedBoleto.status)}>{statusLabel(selectedBoleto.status)}</span>
                  </div>

                  <div className="space-y-4">
                    {buildComposition(selectedBoleto).map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-4">
                        <p className="text-sm font-bold opacity-80">{item.label}</p>
                        <p className="text-sm font-black whitespace-nowrap">
                          {typeof item.amount === 'number' && Number.isFinite(item.amount) ? formatCurrency(item.amount) : ''}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-5 border-t border-[var(--border-color)] flex items-center justify-between">
                    <p className="text-sm font-black uppercase tracking-wider opacity-70">Total a pagar</p>
                    <p className="text-xl font-black">{formatCurrency(selectedBoleto.amount)}</p>
                  </div>
                </div>

                <div className="mt-6 text-sm font-bold opacity-70">
                  Vencimento: <span className="font-black opacity-100">{formatDate(selectedBoleto.dueDate)}</span>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-bold opacity-70 mb-2">
                    Para realizar o pagamento, utilize o código de barras abaixo:
                  </p>

                  <div className="premium-glass rounded-2xl p-4 border border-[var(--border-color)]">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words opacity-80 leading-relaxed m-0">
                      {formatBarcodeDisplay(selectedBoleto.barcode) || 'Código de barras não informado'}
                    </pre>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <button
                      onClick={() => {
                        if (selectedBoleto.barcode) {
                          copyToClipboard(selectedBoleto.barcode);
                        } else {
                          // Se não há código de barras, copiar as informações básicas para pagamento
                          const infoText = `BOLETO - ${formatUnit(selectedBoleto.unit)}\nValor: ${formatCurrency(selectedBoleto.amount)}\nVencimento: ${formatDate(selectedBoleto.dueDate)}\nReferência: ${selectedBoleto.referenceMonth}\n\n*Código de barras não disponível. Entre em contato com a administração.*`;
                          copyToClipboard(infoText);
                        }
                      }}
                      className={`w-full px-6 py-4 rounded-2xl border transition-all flex items-center justify-center gap-3 text-sm font-black uppercase tracking-wider ${
                        copySuccess
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-[var(--glass-bg)] border-[var(--border-color)] hover:bg-[var(--border-color)]'
                      }`}
                      style={copySuccess ? {} : { color: 'var(--text-primary)' }}
                    >
                      {copySuccess ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" /> COPIADO!
                        </>
                      ) : (
                        <>
                          <Copy className="w-5 h-5" /> {selectedBoleto.barcode ? 'COPIAR CÓDIGO DE BARRAS' : 'COPIAR INFORMAÇÕES'}
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleShareBoleto(selectedBoleto)}
                      className="w-full px-6 py-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all flex items-center justify-center gap-3 text-sm font-black uppercase tracking-wider"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Share2 className="w-5 h-5" /> COMPARTILHAR BOLETO
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          console.log('[Boleto] Iniciando download...');

                          // Estratégia de download por prioridade:
                          // 1. PDF Original (novo sistema) - com verificação de integridade
                          // 2. PDF URL (sistema antigo) - download direto
                          // 3. Fallback: informar que não há PDF disponível

                          let downloadUrl = '';
                          let fileName = `boleto_${selectedBoleto.referenceMonth.replace('/', '_')}_${formatUnit(selectedBoleto.unit).replace('/', '_')}.pdf`;
                          let pdfSource = '';

                          // 1. Tentar PDF Original (sistema novo)
                          if (selectedBoleto.pdf_original_path) {
                            console.log('[Boleto] Usando PDF original (sistema novo)');
                            pdfSource = 'PDF original (importado recentemente)';
                            const result = await downloadBoletoOriginalPdf(
                              selectedBoleto.pdf_original_path,
                              selectedBoleto.checksum_pdf
                            );

                            if (result.url) {
                              downloadUrl = result.url;
                            } else {
                              alert(`❌ Erro ao baixar o boleto: ${result.error}\n\nEntre em contato com a administração.`);
                              return;
                            }
                          }
                          // 2. Tentar PDF URL (sistema antigo)
                          else if (selectedBoleto.pdfUrl) {
                            console.log('[Boleto] Usando PDF URL (sistema antigo)');
                            pdfSource = 'PDF do sistema antigo';
                            downloadUrl = selectedBoleto.pdfUrl;
                          }
                          // 3. Nenhum PDF disponível
                          else {
                            const detalhesBoleto = `📋 BOLETO SEM PDF DISPONÍVEL\n\n• Unidade: ${formatUnit(selectedBoleto.unit)}\n• Morador: ${selectedBoleto.residentName}\n• Referência: ${selectedBoleto.referenceMonth}\n• Valor: ${formatCurrency(selectedBoleto.amount)}\n• Status: ${selectedBoleto.status}\n• Vencimento: ${formatDate(selectedBoleto.dueDate)}`;

                            const mensagemOrientacao = `\n\n❌ Este boleto foi importado sem anexar o arquivo PDF original.\n\nPara resolver:\n• Peça ao síndico para reimportar este boleto com o PDF anexado\n• Ou solicite o boleto por e-mail/Whatsapp diretamente\n\nCódigo do boleto: ${selectedBoleto.barcode || 'Não informado'}`;

                            alert(detalhesBoleto + mensagemOrientacao);
                            return;
                          }

                          // Criar link para download direto
                          const link = document.createElement('a');
                          link.href = downloadUrl;
                          link.download = fileName;
                          link.style.display = 'none';

                          // Adicionar ao DOM e clicar
                          document.body.appendChild(link);
                          link.click();

                          // Limpar
                          document.body.removeChild(link);
                          // Só revoke se for blob URL (do sistema novo)
                          if (downloadUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(downloadUrl);
                          }

                          console.log(`[Boleto] PDF baixado com sucesso: ${fileName}`);
                          alert(`✅ Boleto baixado com sucesso!\n\nArquivo: ${fileName}`);
                        } catch (error) {
                          console.error('Erro ao baixar boleto:', error);
                          alert('❌ Erro ao baixar o boleto.\n\nEntre em contato com a administração.');
                        }

                        // Chamar callback adicional se disponível
                        if (onDownloadBoleto) {
                          onDownloadBoleto(selectedBoleto);
                        }
                      }}
                      className="w-full px-6 py-4 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-color)] border border-[var(--text-primary)] hover:opacity-90 transition-all flex items-center justify-center gap-3 text-sm font-black uppercase tracking-wider"
                      title="Baixar boleto em formato PDF"
                    >
                      <Download className="w-5 h-5" /> BAIXAR BOLETO
                    </button>

                    {selectedBoleto.pdfUrl && onViewBoleto && (
                      <button
                        onClick={() => onViewBoleto(selectedBoleto)}
                        className="w-full px-6 py-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all flex items-center justify-center gap-3 text-sm font-black uppercase tracking-wider"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Eye className="w-5 h-5" /> Visualizar boleto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Versão completa para administradores
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Boletos</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Condomínio, Água e Luz</p>
        </div>
        {showImportButton && (
          <>
            <button
              type="button"
              onClick={handleImportClick}
              data-import-button="boletos"
              className="px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2 hover:bg-[var(--border-color)]"
            >
              <Upload className="w-4 h-4" />
              Importar Boletos
            </button>
          </>
        )}
      </header>


      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-glass rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider opacity-40">Total</span>
            <FileText className="w-4 h-4 opacity-40" />
          </div>
          <p className="text-2xl font-black">{stats.total}</p>
        </div>
        <div className="premium-glass rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider opacity-40">Pendentes</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-400">{stats.pendentes}</p>
        </div>
        <div className="premium-glass rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider opacity-40">Vencidos</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-400">{stats.vencidos}</p>
        </div>
        <div className="premium-glass rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider opacity-40">A Receber</span>
            <DollarSign className="w-4 h-4 opacity-40" />
          </div>
          <p className="text-xl font-black">{formatCurrency(stats.pendenteAmount)}</p>
        </div>
      </div>

      {/* Filtros: Tipo (Condomínio/Água/Luz) e Busca */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-black uppercase tracking-wider opacity-50 mr-1">Tipo:</span>
          {(['all', 'condominio', 'agua', 'luz'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                typeFilter === type
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)] hover:bg-[var(--border-color)] text-[var(--text-primary)]'
              }`}
            >
              {type === 'all' ? 'Todos' : BOLETO_TYPE_ICONS[type]}{type === 'all' ? null : BOLETO_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text" 
              placeholder="Buscar por Morador, Unidade ou Mês/Ano..." 
              value={boletoSearch}
              onChange={e => setBoletoSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-xs font-bold outline-none focus:border-[var(--text-primary)]/50 transition-all placeholder:opacity-40"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'Pendente', 'Vencido', 'Pago'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${
                  statusFilter === filter
                    ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                    : 'bg-[var(--glass-bg)] border-[var(--border-color)] hover:bg-[var(--border-color)] text-[var(--text-primary)]'
                }`}
              >
                {filter === 'all' ? 'Todos' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Boletos */}
      {isLoading ? (
        <div className="grid gap-4">
          {/* Skeleton loader para boletos */}
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="premium-glass rounded-2xl p-6 border border-[var(--border-color)] animate-pulse">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-5 h-5 bg-white/10 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-white/10 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-white/10 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <div className="h-3 bg-white/10 rounded w-20"></div>
                    <div className="h-3 bg-white/10 rounded w-24"></div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <div className="h-6 bg-white/10 rounded w-20 mb-1"></div>
                    <div className="h-4 bg-white/10 rounded w-16"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-white/10 rounded-xl"></div>
                    <div className="w-8 h-8 bg-white/10 rounded-xl"></div>
                    <div className="w-8 h-8 bg-white/10 rounded-xl"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredBoletos.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
          <FileText className="w-16 h-16 opacity-20" />
          <h3 className="text-xl font-black uppercase tracking-tight opacity-40">
            {boletoSearch || statusFilter !== 'all' ? 'Nenhum boleto encontrado' : 'Nenhum boleto cadastrado'}
          </h3>
          <p className="text-sm opacity-30 text-center max-w-md">
            {boletoSearch || statusFilter !== 'all' 
              ? 'Tente ajustar os filtros de busca' 
              : 'Os boletos aparecerão aqui quando forem cadastrados'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBoletos.map((boleto) => {
            const resident = allResidents.find(r => r.unit === boleto.unit);
            return (
              <div
                key={boleto.id}
                className="premium-glass rounded-2xl p-6 border border-[var(--border-color)] hover:border-[var(--text-primary)]/30 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(boleto.status)}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-lg font-black uppercase tracking-tight">
                            {boleto.residentName}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-[var(--text-primary)] flex items-center gap-1">
                            {BOLETO_TYPE_ICONS[boleto.boletoType || 'condominio']}
                            {BOLETO_TYPE_LABELS[boleto.boletoType || 'condominio']}
                          </span>
                        </div>
                        <p className="text-xs opacity-40 font-bold uppercase tracking-wider">
                          {formatUnit(boleto.unit)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 opacity-40" />
                        <span className="text-xs font-bold opacity-60">
                          Referência: {boleto.referenceMonth}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 opacity-40" />
                        <span className={`text-xs font-bold ${
                          boleto.status === 'Vencido' ? 'text-red-400' : 'opacity-60'
                        }`}>
                          Vencimento: {formatDate(boleto.dueDate)}
                        </span>
                      </div>
                      {boleto.paidDate && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-bold text-green-400">
                            Pago em: {formatDate(boleto.paidDate)}
                          </span>
                        </div>
                      )}
                    </div>
                    {boleto.description && (
                      <p className="text-xs opacity-50 mt-2">{boleto.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-black mb-1">
                        {formatCurrency(boleto.amount)}
                      </p>
                      <span className={getStatusBadge(boleto.status)}>
                        {boleto.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {(boleto.pdfUrl || boleto.pdf_original_path) ? (
                        <>
                          {onViewBoleto && boleto.pdfUrl && (
                            <button
                              onClick={() => onViewBoleto(boleto)}
                              className="p-2 rounded-xl bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all group-hover:border-[var(--text-primary)]/50"
                              style={{ color: 'var(--text-primary)' }}
                              title="Visualizar Boleto"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {onDownloadBoleto && (
                            <button
                              onClick={() => onDownloadBoleto(boleto)}
                              className="p-2 rounded-xl bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all group-hover:border-[var(--text-primary)]/50"
                              style={{ color: 'var(--text-primary)' }}
                              title={boleto.pdf_original_path ? "Baixar PDF Original" : "Baixar PDF"}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        // Botão para anexar PDF quando não há nenhum
                        <button
                          onClick={() => {
                            // Criar input file oculto
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.pdf';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (!file) return;

                              try {
                                const { addBoletoOriginalPdf } = await import('../../services/dataService');
                                const result = await addBoletoOriginalPdf(boleto.id, file);

                                if (result.success) {
                                  alert(`✅ PDF anexado com sucesso ao boleto de ${boleto.residentName} - ${boleto.referenceMonth}`);
                                  // Recarregar dados
                                  window.location.reload();
                                } else {
                                  alert(`❌ Erro ao anexar PDF: ${result.error}`);
                                }
                              } catch (error) {
                                console.error('Erro ao anexar PDF:', error);
                                alert('❌ Erro ao anexar PDF. Tente novamente.');
                              }
                            };
                            input.click();
                          }}
                          className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                          title="Anexar PDF ao boleto"
                        >
                          <Upload className="w-4 h-4 text-amber-500" />
                        </button>
                      )}
                      {onDeleteBoleto && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja excluir o boleto de ${boleto.residentName} - ${boleto.referenceMonth}?`)) {
                              onDeleteBoleto(boleto);
                            }
                          }}
                          className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all group-hover:border-red-500/50"
                          title="Excluir Boleto"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {boleto.barcode && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                    <p className="text-xs opacity-40 font-mono mb-1">Código de Barras:</p>
                    <p className="text-xs font-mono opacity-60 break-all">{boleto.barcode}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BoletosView;

