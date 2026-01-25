
import React from 'react';
import { Search, Plus, Camera, Image as ImageIcon } from 'lucide-react';
import { Package } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';
import { isMobile } from '../../utils/deviceDetection';

interface PackagesViewProps {
  allPackages: Package[];
  packageSearch: string;
  setPackageSearch: (val: string) => void;
  setIsNewPackageModalOpen: (val: boolean) => void;
  setSelectedPackageForDetail: (pkg: Package) => void;
  onCameraScan?: () => void;
}

const PackagesView: React.FC<PackagesViewProps> = ({
  allPackages,
  packageSearch,
  setPackageSearch,
  setIsNewPackageModalOpen,
  setSelectedPackageForDetail,
  onCameraScan,
}) => {
  const mobile = isMobile();
  const canUseCamera = mobile && !!onCameraScan;

  const displayPackages = allPackages.filter((p) => 
    p.recipient.toLowerCase().includes(packageSearch.toLowerCase()) ||
    p.type.toLowerCase().includes(packageSearch.toLowerCase()) ||
    p.unit.toLowerCase().includes(packageSearch.toLowerCase()) ||
    p.displayTime.toLowerCase().includes(packageSearch.toLowerCase()) ||
    p.status.toLowerCase().includes(packageSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-3xl font-black uppercase tracking-tighter">Encomendas</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input
              type="text"
              placeholder="Pesquisar Encomenda..."
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-xs font-bold outline-none focus:border-[var(--text-primary)]/50 transition-all placeholder:opacity-40"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {canUseCamera && (
              <>
                <button
                  onClick={onCameraScan}
                  className="px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2 hover:bg-[var(--border-color)]"
                >
                  <Camera className="w-4 h-4" /> Escanear
                </button>
                <button
                  onClick={onCameraScan}
                  className="px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2 hover:bg-[var(--border-color)]"
                >
                  <ImageIcon className="w-4 h-4" /> Registrar por foto
                </button>
              </>
            )}
            {!mobile && onCameraScan && (
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 py-2" style={{ color: 'var(--text-secondary)' }}>
                Registro por câmera disponível apenas no celular
              </p>
            )}
            <button
              onClick={() => setIsNewPackageModalOpen()}
              className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Novo Registro
            </button>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayPackages.map(pkg => (
          <div 
            key={pkg.id} 
            onClick={() => setSelectedPackageForDetail(pkg)}
            className="premium-glass p-6 rounded-[32px] flex justify-between items-center cursor-pointer group"
          >
            <div>
              <p className="text-[10px] font-black opacity-40 uppercase">{pkg.type}</p>
              <h4 className="font-black text-lg group-hover:text-blue-500 transition-colors">{pkg.recipient}</h4>
              <p className="text-xs opacity-60">{formatUnit(pkg.unit)} • {pkg.displayTime}</p>
              {pkg.items && pkg.items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {pkg.items.slice(0, 2).map((it, idx) => (
                    <span key={idx} className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded-md uppercase font-bold opacity-40">{it.name}</span>
                  ))}
                  {pkg.items.length > 2 && <span className="text-[8px] opacity-20 font-bold">+{pkg.items.length - 2}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${pkg.status === 'Pendente' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
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
