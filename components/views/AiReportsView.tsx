import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  Users, 
  Download, 
  RefreshCcw,
  CheckCircle2,
  BrainCircuit,
  PieChart,
  Calendar,
  BarChart3,
  Activity,
  Shield,
  ShieldAlert,
  Target,
  Clock
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAppConfig } from '../../contexts/AppConfigContext';
import { useToast } from '../../contexts/ToastContext';
import { extractGeminiText } from '../../utils/geminiHelpers';
import { logger } from '../../utils/logger';

interface AiReportsViewProps {
  allPackages: any[];
  visitorLogs: any[];
  allOccurrences: any[];
  allNotes: any[];
  dayReservations: any[];
}

const AiReportsView: React.FC<AiReportsViewProps> = ({
  allPackages,
  visitorLogs,
  allOccurrences,
  allNotes,
  dayReservations
}) => {
  const { config } = useAppConfig();
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'previous'>('current');

  // Cálculos de métricas
  const metrics = useMemo(() => {
    const totalVisitors = visitorLogs.length;
    const activeVisitors = visitorLogs.filter(v => v.status === 'active').length;
    const totalPackages = allPackages.length;
    const pendingPackages = allPackages.filter(p => p.status === 'Pendente').length;
    const deliveredPackages = allPackages.filter(p => p.status === 'Entregue').length;
    const openOccurrences = allOccurrences.filter(o => o.status === 'Aberto').length;
    const resolvedOccurrences = allOccurrences.filter(o => o.status === 'Resolvido').length;
    const totalOccurrences = allOccurrences.length;
    const resolutionRate = totalOccurrences > 0 ? Math.round((resolvedOccurrences / totalOccurrences) * 100) : 100;
    const pendingNotes = allNotes.filter(n => !n.completed).length;

    return {
      totalVisitors,
      activeVisitors,
      totalPackages,
      pendingPackages,
      deliveredPackages,
      openOccurrences,
      resolvedOccurrences,
      totalOccurrences,
      resolutionRate,
      pendingNotes,
      totalReservations: dayReservations.length
    };
  }, [visitorLogs, allPackages, allOccurrences, allNotes, dayReservations]);

  const hasGeminiKey = !!(process.env.API_KEY && String(process.env.API_KEY).trim());

  const handleGenerateReport = async () => {
    if (!hasGeminiKey) {
      setReportContent('Configure GEMINI_API_KEY no arquivo .env ou nas variáveis de ambiente do Vercel para gerar relatórios com IA.');
      return;
    }
    setIsGenerating(true);
    setReportContent(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const dataContext = `
        DADOS DO PERÍODO:
        - Total Visitantes: ${metrics.totalVisitors} (Ativos agora: ${metrics.activeVisitors})
        - Total Encomendas: ${metrics.totalPackages} (Pendentes: ${metrics.pendingPackages}, Entregues: ${metrics.deliveredPackages})
        - Ocorrências: ${metrics.totalOccurrences} (Abertas: ${metrics.openOccurrences}, Resolvidas: ${metrics.resolvedOccurrences})
        - Taxa de Resolução: ${metrics.resolutionRate}%
        - Reservas de Área Comum: ${metrics.totalReservations}
        - Notas Pendentes: ${metrics.pendingNotes}
        
        DETALHES OCORRÊNCIAS:
        ${allOccurrences.map(o => `- ${o.description} (Status: ${o.status}, Unidade: ${o.unit})`).join('\n')}

        NOTAS OPERACIONAIS PENDENTES:
        ${allNotes.filter(n => !n.completed).map(n => `- ${n.content} (${n.category || 'Geral'})`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `
          Atue como um Especialista em Gestão Condominial Sênior (Síndico Profissional).
          Analise os dados brutos abaixo coletados pelo sistema de portaria e gere um RELATÓRIO EXECUTIVO PARA ASSEMBLEIA.
          
          Estrutura Obrigatória do Relatório (Use Markdown):
          1. **Resumo Executivo**: Um parágrafo sobre a "saúde" operacional do prédio.
          2. **Destaques de Segurança**: Analise as ocorrências e visitantes. Identifique riscos.
          3. **Eficiência Logística**: Analise o fluxo de encomendas. Sugira melhorias se houver muitos pendentes.
          4. **Manutenção & Zeladoria**: Baseado nas notas e ocorrências.
          5. **Sugestão de Pauta**: 3 tópicos prioritários para discutir na próxima assembleia baseados nestes dados.

          Tom de voz: Formal, Objetivo, Imparcial e Focado em Soluções.

          DADOS:
          ${dataContext}
        `,
      });

      const text = extractGeminiText(response);
      setReportContent(text || "Não foi possível gerar o relatório.");
    } catch (error: unknown) {
      logger.error(error);
      const err = error as { message?: string };
      const msg = (typeof err?.message === 'string' && err.message.toLowerCase().includes('api')) || !hasGeminiKey
        ? 'Configure GEMINI_API_KEY no .env ou nas variáveis do Vercel para gerar relatórios com IA.'
        : 'Erro ao conectar com a Inteligência Artificial. Verifique sua conexão e tente novamente.';
      setReportContent(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!reportContent) {
      toast.error('Gere o relatório antes de exportar.');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Permita pop-ups para exportar o PDF.');
      return;
    }
    const title = `Relatório IA - ${config.condominiumName} - ${new Date().toLocaleDateString('pt-BR')}`;
    win.document.write(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 1rem; color: #1a1a1a; line-height: 1.6; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .meta { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
        pre { white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 1rem; border-radius: 8px; font-size: 0.875rem; }
      </style></head>
      <body>
        <h1>Relatório Inteligente – ${config.condominiumName}</h1>
        <p class="meta">${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })} • Gerado por IA</p>
        <pre>${reportContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {!hasGeminiKey && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-200">
            Configure <code className="bg-black/20 px-1.5 py-0.5 rounded">GEMINI_API_KEY</code> no <code className="bg-black/20 px-1.5 py-0.5 rounded">.env</code> ou nas variáveis do Vercel para gerar relatórios com IA.
          </p>
        </div>
      )}
      {/* HEADER MODERNO */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400 shadow-lg">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-contrast-high">
                Relatórios Inteligentes
              </h2>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low mt-1">
                Análise IA para Assembleias • {config.condominiumName}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 premium-glass p-1 rounded-2xl border border-[var(--border-color)]">
          <button
            onClick={() => setSelectedPeriod('current')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              selectedPeriod === 'current'
                ? 'bg-[var(--text-primary)] text-[var(--bg-color)] shadow-lg'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Mês Atual
          </button>
          <button
            onClick={() => setSelectedPeriod('previous')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              selectedPeriod === 'previous'
                ? 'bg-[var(--text-primary)] text-[var(--bg-color)] shadow-lg'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Mês Anterior
          </button>
        </div>
      </header>

      {/* KPIs PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              +12%
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.totalVisitors}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Acessos Totais
          </p>
          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {metrics.activeVisitors} Ativos Agora
            </span>
          </div>
        </div>

        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              Estável
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.totalPackages}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Volumes Recebidos
          </p>
          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)]">
            <div className={`w-2 h-2 rounded-full ${metrics.pendingPackages > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {metrics.pendingPackages} Aguardando
            </span>
          </div>
        </div>

        <div className={`premium-glass rounded-[24px] p-6 border ${
          metrics.openOccurrences > 0 ? 'border-red-500/20' : 'border-[var(--border-color)]'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            {metrics.openOccurrences > 0 && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2 py-1 rounded-lg animate-pulse">
                Atenção
              </span>
            )}
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.totalOccurrences}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Ocorrências Totais
          </p>
          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)]">
            <div className={`w-2 h-2 rounded-full ${metrics.openOccurrences > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {metrics.openOccurrences} Em Aberto
            </span>
          </div>
          </div>

        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              Taxa
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.resolutionRate}%
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Resolução de Ocorrências
          </p>
          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-color)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">
              {metrics.resolvedOccurrences} Resolvidas
            </span>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE RELATÓRIO */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Área Principal do Relatório */}
        <div className="flex-1 premium-glass rounded-[32px] p-8 border border-[var(--border-color)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <FileText className="w-64 h-64 text-[var(--text-primary)]" />
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-contrast-high">
                  Relatório Executivo
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-2">
                  Preparatório para Assembleia
                </p>
              </div>
              {!isGenerating && !reportContent && (
                <button
                  onClick={handleGenerateReport}
                  disabled={!hasGeminiKey}
                  className={`group px-6 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all shadow-lg flex items-center gap-2 ${
                    hasGeminiKey
                      ? 'bg-[var(--text-primary)] text-[var(--bg-color)] hover:scale-105'
                      : 'bg-zinc-600 text-zinc-400 cursor-not-allowed opacity-70'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${hasGeminiKey ? 'group-hover:animate-spin' : ''}`} />
                  {hasGeminiKey ? 'Gerar com IA' : 'Configure GEMINI_API_KEY'}
                </button>
              )}
            </div>

            {isGenerating && (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BrainCircuit className="w-8 h-8 text-[var(--text-primary)] animate-pulse" />
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight text-contrast-high">
                    Processando Dados
                  </h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-2">
                    Analisando ocorrências e métricas...
                  </p>
                </div>
              </div>
            )}

            {reportContent && !isGenerating && (
              <div className="animate-in slide-in-from-bottom-8 duration-700">
                <div className="premium-glass p-8 rounded-[24px] border border-[var(--border-color)] mb-6">
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-line leading-relaxed font-medium text-[var(--text-primary)]">
                    {reportContent}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setReportContent(null)}
                    className="px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[var(--glass-bg)]/80 transition-all flex items-center gap-2"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Regenerar
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar PDF
                  </button>
                </div>
              </div>
            )}

            {!isGenerating && !reportContent && (
              <div className="py-12 border-2 border-dashed border-[var(--border-color)] rounded-[24px] flex flex-col items-center justify-center text-center opacity-40">
                <PieChart className="w-12 h-12 mb-4 text-[var(--text-secondary)]" />
                <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {hasGeminiKey ? 'Nenhum relatório gerado ainda' : 'Configure GEMINI_API_KEY para gerar relatórios'}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  {hasGeminiKey ? 'Clique em "Gerar com IA" para criar um relatório executivo' : 'Adicione a chave no .env ou nas variáveis do Vercel.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar de Insights */}
        <div className="w-full lg:w-80 space-y-4">
          <div className="premium-glass rounded-[24px] p-6 border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-black uppercase text-xs tracking-widest">
                Alertas da IA
              </h4>
            </div>
            <div className="space-y-3">
              {metrics.pendingPackages > 10 && (
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <p className="text-xs font-bold text-amber-200 leading-tight">
                    Acúmulo de encomendas detectado. Considere emitir alerta aos moradores.
                  </p>
                </div>
              )}
              {metrics.openOccurrences > 2 && (
                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                  <p className="text-xs font-bold text-red-300 leading-tight">
                    Ocorrências de segurança acima da média. Requer atenção imediata.
                  </p>
                </div>
              )}
              {metrics.activeVisitors > 5 && (
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <p className="text-xs font-bold text-blue-300 leading-tight">
                    Alto fluxo de visitantes detectado. Portaria pode estar sobrecarregada.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
            <div className="flex items-center gap-3 mb-4 text-[var(--text-primary)]">
              <CheckCircle2 className="w-5 h-5" />
              <h4 className="font-black uppercase text-xs tracking-widest">
                Pontos Positivos
              </h4>
            </div>
            <ul className="space-y-3">
              {metrics.resolutionRate >= 80 && (
                <li className="flex items-start gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <span>Taxa de resolução de ocorrências excelente ({metrics.resolutionRate}%)</span>
                </li>
              )}
              {metrics.pendingPackages <= 5 && (
                <li className="flex items-start gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <span>Gestão de encomendas eficiente</span>
                </li>
              )}
              <li className="flex items-start gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span>Sistema operacional estável e funcional</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiReportsView;
