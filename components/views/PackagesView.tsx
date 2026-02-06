
import React, { useState, useEffect } from 'react';
import { Search, Plus, Camera, Image as ImageIcon, Users, ChevronDown, ChevronUp, Trash2, Download, Filter } from 'lucide-react';
import { Package, Resident } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';
import { isMobile } from '../../utils/deviceDetection';
import { exportPackagesToCSV, exportPackagesToJSON, exportPackagesToPDF } from '../../utils/exportPackages';

interface PackagesViewProps {
  allPackages: Package[];
  allResidents?: Resident[];
  packageSearch: string;
  setPackageSearch: (val: string) => void;
  setIsNewPackageModalOpen: (val: boolean) => void;
  setSelectedPackageForDetail: (pkg: Package) => void;
  onDeletePackage?: (id: string) => void;
  onCameraScan?: () => void;
  /** 
   * Define se o usuário atual pode registrar novas encomendas.
   * Para moradores, este valor deve ser false para impedir o registro.
   */
  canRegister?: boolean;
}

const PackagesView: React.FC<PackagesViewProps> = ({
  allPackages,
  allResidents = [],
  packageSearch,
  setPackageSearch,
  setIsNewPackageModalOpen,
  setSelectedPackageForDetail,
  onDeletePackage,
  onCameraScan,
  canRegister = true,
}) => {
  const mobile = isMobile();
  const canUseCamera = mobile && !!onCameraScan;
  const [residentsExpanded, setResidentsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Entregue'>('all');

  const displayPackages = allPackages.filter((p) => {
    // Aplicar filtro de status
    if (statusFilter !== 'all' && p.status !== statusFilter) {
      return false;
    }
    
    // Aplicar busca por texto (se houver busca)
    if (packageSearch.trim()) {
      const searchLower = packageSearch.toLowerCase();
      return (
        p.recipient.toLowerCase().includes(searchLower) ||
        p.type.toLowerCase().includes(searchLower) ||
        p.unit.toLowerCase().includes(searchLower) ||
        (p.displayTime && p.displayTime.toLowerCase().includes(searchLower)) ||
        p.status.toLowerCase().includes(searchLower)
      );
    }
    
    // Se não houver busca, retornar todas que passaram no filtro de status
    return true;
  });

  // Log para debug
  useEffect(() => {
    console.log('[PackagesView]', {
      totalAllPackages: allPackages.length,
      displayPackagesCount: displayPackages.length,
      statusFilter,
      packageSearch,
      samplePackages: displayPackages.slice(0, 3).map(p => ({ id: p.id, unit: p.unit, status: p.status }))
    });
  }, [allPackages.length, displayPackages.length, statusFilter, packageSearch]);

  const pendingCount = allPackages.filter(p => p.status === 'Pendente').length;
  const deliveredCount = allPackages.filter(p => p.status === 'Entregue').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">Encomendas</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-30" />
            <input
              type="text"
              placeholder="Pesquisar Encomenda..."
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[11px] sm:text-xs font-bold outline-none focus:border-[var(--text-primary)]/50 transition-all placeholder:opacity-40"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          {/* Filtros rápidos de status */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 opacity-40" style={{ color: 'var(--text-secondary)' }} />
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase transition-all ${
                statusFilter === 'all'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                  : 'bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--border-color)]'
              }`}
            >
              Todas ({allPackages.length})
            </button>
            <button
              onClick={() => setStatusFilter('Pendente')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase transition-all ${
                statusFilter === 'Pendente'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('Entregue')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase transition-all ${
                statusFilter === 'Entregue'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
              }`}
            >
              Entregues ({deliveredCount})
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {canUseCamera && (
              <>
                <button
                  onClick={onCameraScan}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[9px] sm:text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-1.5 sm:gap-2 hover:bg-[var(--border-color)]"
                >
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Escanear</span>
                </button>
                <button
                  onClick={onCameraScan}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[9px] sm:text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-1.5 sm:gap-2 hover:bg-[var(--border-color)]"
                >
                  <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Registrar por foto</span>
                </button>
              </>
            )}
            {!mobile && onCameraScan && (
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 py-2" style={{ color: 'var(--text-secondary)' }}>
                Registro por câmera disponível apenas no celular
              </p>
            )}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[9px] sm:text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-1.5 sm:gap-2 hover:bg-[var(--border-color)] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar encomendas"
              >
                <Download className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isExporting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isExporting ? 'Exportando...' : 'Exportar'}</span>
              </button>
              {showExportMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-20 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden min-w-[180px]">
                    <button
                      onClick={async () => {
                        setIsExporting(true);
                        setShowExportMenu(false);
                        try {
                          await exportPackagesToCSV(allPackages);
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-[var(--border-color)] transition-colors flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Download className="w-4 h-4" />
                      Exportar CSV
                    </button>
                    <button
                      onClick={async () => {
                        setIsExporting(true);
                        setShowExportMenu(false);
                        try {
                          await exportPackagesToJSON(allPackages);
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-[var(--border-color)] transition-colors flex items-center gap-2 border-t border-[var(--border-color)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Download className="w-4 h-4" />
                      Exportar JSON
                    </button>
                    <button
                      onClick={async () => {
                        setIsExporting(true);
                        setShowExportMenu(false);
                        try {
                          await exportPackagesToPDF(allPackages);
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-[var(--border-color)] transition-colors flex items-center gap-2 border-t border-[var(--border-color)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Download className="w-4 h-4" />
                      Exportar PDF
                    </button>
                  </div>
                </>
              )}
            </div>
            {canRegister && (
              <button
                onClick={() => setIsNewPackageModalOpen(true)}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-full text-[9px] sm:text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-1.5 sm:gap-2"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Novo Registro</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {allResidents.length > 0 && (
        <section className="premium-glass rounded-[24px] p-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setResidentsExpanded((e) => !e)}
            className="w-full flex items-center justify-between gap-2 py-2"
          >
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-70" style={{ color: 'var(--text-secondary)' }}>
              <Users className="w-4 h-4" />
              Moradores cadastrados ({allResidents.length})
            </span>
            {residentsExpanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
          </button>
          {residentsExpanded && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-2 mt-2 border-t border-white/5 max-h-64 overflow-y-auto custom-scrollbar">
              {allResidents.map((r) => (
                <div
                  key={r.id}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                >
                  <p className="font-black text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--text-secondary)' }}>{formatUnit(r.unit)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {displayPackages.map(pkg => (
          <div 
            key={pkg.id} 
            onClick={() => setSelectedPackageForDetail(pkg)}
            className="premium-glass p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] flex justify-between items-center cursor-pointer group relative gap-3 sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[9px] sm:text-[10px] font-black opacity-40 uppercase">{pkg.type}</p>
              <h4 className="font-black text-base sm:text-lg group-hover:text-blue-500 transition-colors truncate">{pkg.recipient}</h4>
              <p className="text-[11px] sm:text-xs opacity-60">{formatUnit(pkg.unit)} • {pkg.displayTime}</p>
              {pkg.items && pkg.items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {pkg.items.slice(0, 2).map((it, idx) => (
                    <span key={idx} className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded-md uppercase font-bold opacity-40">{it.name}</span>
                  ))}
                  {pkg.items.length > 2 && <span className="text-[8px] opacity-20 font-bold">+{pkg.items.length - 2}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {onDeletePackage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePackage(pkg.id);
                  }}
                  className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-[var(--border-color)] bg-[var(--glass-bg)] text-red-500/90 hover:bg-red-500/10 hover:border-red-500/30 transition-all focus:ring-2 focus:ring-red-400/30 focus:outline-none"
                  aria-label="Excluir encomenda"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              <span className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase ${pkg.status === 'Pendente' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                {pkg.status}
              </span>
            </div>
          </div>
        ))}
        {displayPackages.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-sm tracking-widest border-2 border-dashed border-white/5 rounded-[48px]">
             Nenhuma encomenda encontrada
          </div>
        )}
      </div>
    </div>
  );
};

export default PackagesView;
