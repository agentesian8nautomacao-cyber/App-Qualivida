import React, { useMemo } from 'react';
import { 
  BrainCircuit, 
  MessageSquare, 
  FileText, 
  Megaphone, 
  Users, 
  Package, 
  ShieldAlert, 
  TrendingUp, 
  Activity, 
  ArrowRight,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Target
} from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface SindicoDashboardViewProps {
  allPackages: any[];
  visitorLogs: any[];
  allOccurrences: any[];
  allResidents: any[];
  setActiveTab: (tab: string) => void;
  setActiveNoticeTab: (tab: 'wall' | 'chat') => void;
}

const SindicoDashboardView: React.FC<SindicoDashboardViewProps> = ({
  allPackages,
  visitorLogs,
  allOccurrences,
  allResidents,
  setActiveTab,
  setActiveNoticeTab
}) => {
  const { config } = useAppConfig();

  // Cálculos e análises
  const metrics = useMemo(() => {
    const activeVisitors = visitorLogs.filter(v => {
      const st = String(v.status || '').toLowerCase();
      return st === 'confirmado' || st === 'active';
    }).length;
    const pendingPackages = allPackages.filter(p => p.status === 'pendente').length;
    const openOccurrences = allOccurrences.filter(o => o.status === 'Aberto').length;
    const resolvedOccurrences = allOccurrences.filter(o => o.status === 'Resolvido').length;
    const totalOccurrences = allOccurrences.length;
    const resolutionRate = totalOccurrences > 0 ? Math.round((resolvedOccurrences / totalOccurrences) * 100) : 100;

    return {
      activeVisitors,
      pendingPackages,
      openOccurrences,
      resolvedOccurrences,
      resolutionRate,
      totalResidents: allResidents.length
    };
  }, [visitorLogs, allPackages, allOccurrences, allResidents]);

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (value <= thresholds.warning) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* HEADER MODERNO */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl text-amber-500 shadow-lg">
              <BrainCircuit className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-contrast-high">
                Painel Executivo
              </h2>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low mt-1">
                {config.condominiumName} • Gestão Estratégica
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Sistema Operacional
            </span>
          </div>
        </div>
      </header>

      {/* MÉTRICAS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              Visitantes
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.activeVisitors}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {metrics.activeVisitors > 5 ? 'Alto fluxo detectado' : 'Fluxo normal'}
          </p>
        </div>

        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              Encomendas
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.pendingPackages}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {metrics.pendingPackages > 10 ? 'Atenção necessária' : 'Em dia'}
          </p>
        </div>

        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              Ocorrências
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.openOccurrences}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {metrics.openOccurrences > 0 ? 'Requer atenção' : 'Tudo resolvido'}
          </p>
        </div>

        <div className="premium-glass rounded-[24px] p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              Taxa Resolução
            </span>
          </div>
          <h3 className="text-3xl font-black text-[var(--text-primary)] mb-1">
            {metrics.resolutionRate}%
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {metrics.resolvedOccurrences} de {allOccurrences.length} resolvidas
          </p>
        </div>
      </div>

      {/* AÇÕES RÁPIDAS */}
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-contrast-high">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => { setActiveTab('notices'); setActiveNoticeTab('chat'); }}
            className="group premium-glass rounded-[24px] p-6 text-left transition-all hover:scale-[1.02] border border-[var(--border-color)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Chat com Portaria
                </h4>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                  Comunicação direta
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className="group premium-glass rounded-[24px] p-6 text-left transition-all hover:scale-[1.02] border border-[var(--border-color)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Relatórios IA
                </h4>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                  Análise inteligente
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button
            onClick={() => { setActiveTab('notices'); setActiveNoticeTab('wall'); }}
            className="group premium-glass rounded-[24px] p-6 text-left transition-all hover:scale-[1.02] border border-[var(--border-color)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 group-hover:scale-110 transition-transform">
                <Megaphone className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Novo Comunicado
                </h4>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                  Mural digital
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>
      </div>

      {/* INSIGHTS E ALERTAS */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-[var(--text-primary)]" />
          <h3 className="text-lg font-black uppercase tracking-tight text-contrast-high">
            Insights em Tempo Real
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card de Visitantes */}
          <div className={`premium-glass rounded-[32px] p-8 border transition-all hover:scale-[1.01] ${getStatusColor(metrics.activeVisitors, { good: 3, warning: 5 })}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-black/20 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  Fluxo de Acesso
                </span>
              </div>
              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-black/20`}>
                {metrics.activeVisitors > 5 ? 'Atenção' : 'Estável'}
              </span>
            </div>
            
            <h4 className="text-2xl font-black uppercase text-[var(--text-primary)] mb-3">
              {metrics.activeVisitors > 5 ? 'Alto Fluxo' : 'Fluxo Normal'}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              {metrics.activeVisitors > 5 
                ? `Detectado ${metrics.activeVisitors} visitantes simultâneos. A portaria pode estar sobrecarregada.`
                : `Fluxo controlado com ${metrics.activeVisitors} visitante${metrics.activeVisitors !== 1 ? 's' : ''} no momento. Operação dentro da normalidade.`}
            </p>
            <button 
              onClick={() => setActiveTab('visitors')} 
              className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity text-[var(--text-primary)]"
            >
              Ver Detalhes <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Card de Ocorrências */}
          <div className={`premium-glass rounded-[32px] p-8 border transition-all hover:scale-[1.01] ${getStatusColor(metrics.openOccurrences, { good: 0, warning: 1 })}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-black/20 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  Segurança & Social
                </span>
              </div>
              {metrics.openOccurrences > 0 && (
                <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-500 text-white animate-pulse">
                  Ação Necessária
                </span>
              )}
            </div>
            
            <h4 className="text-2xl font-black uppercase text-[var(--text-primary)] mb-3">
              {metrics.openOccurrences > 0 ? 'Incidente Ativo' : 'Perímetro Seguro'}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              {metrics.openOccurrences > 0 
                ? `Existem ${metrics.openOccurrences} ocorrência${metrics.openOccurrences !== 1 ? 's' : ''} em aberto requerendo atenção ou mediação imediata.`
                : `Nenhuma ocorrência em aberto. O ambiente condominial encontra-se pacífico e seguro.`}
            </p>
            <button 
              onClick={() => setActiveTab('occurrences')} 
              className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-opacity text-[var(--text-primary)]"
            >
              Resolver <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ESTATÍSTICAS RÁPIDAS */}
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight mb-4 text-contrast-high">
          Estatísticas do Condomínio
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="premium-glass rounded-[20px] p-5 border border-[var(--border-color)]">
            <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] block mb-2">
              Ocupação
            </span>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              94% <span className="text-[10px] text-emerald-500">▲</span>
            </p>
          </div>
          <div className="premium-glass rounded-[20px] p-5 border border-[var(--border-color)]">
            <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] block mb-2">
              Inadimplência
            </span>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              2.1% <span className="text-[10px] text-emerald-500">▼</span>
            </p>
          </div>
          <div className="premium-glass rounded-[20px] p-5 border border-[var(--border-color)]">
            <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] block mb-2">
              Moradores
            </span>
            <p className="text-2xl font-black text-[var(--text-primary)]">
              {metrics.totalResidents}
            </p>
          </div>
          <div className="premium-glass rounded-[20px] p-5 border border-[var(--border-color)]">
            <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] block mb-2">
              NPS
            </span>
            <p className="text-2xl font-black text-amber-500">
              78
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SindicoDashboardView;
