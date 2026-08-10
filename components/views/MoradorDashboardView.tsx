
import React, { useState, useMemo } from 'react';
import { Megaphone, Receipt, Calendar, Package, AlertCircle, FileText, Eye, Download } from 'lucide-react';
import { Boleto, Notice, Package as PackageType, Resident } from '../../types';
import { formatUnit, compareUnits } from '../../utils/unitFormatter';

interface MoradorDashboardViewProps {
  currentResident: Resident;
  allBoletos: Boleto[];
  allNotices: Notice[];
  allPackages: PackageType[];
  allReservations: any[];
  onViewBoleto?: (boleto: Boleto) => void;
  onDownloadBoleto?: (boleto: Boleto) => void;
  onViewPackage?: (pkg: PackageType) => void;
  onViewNotice?: (notice: Notice) => void;
}

const MoradorDashboardView: React.FC<MoradorDashboardViewProps> = ({
  currentResident,
  allBoletos,
  allNotices,
  allPackages,
  allReservations,
  onViewBoleto,
  onDownloadBoleto,
  onViewPackage,
  onViewNotice
}) => {
  // Filtrar apenas dados do morador logado.
  // Regra: boletos devem estar associados ao morador_id (resident_id). Fallback por unidade para legado.
  const residentUnit = currentResident.unit;
  const residentId = currentResident.id;
  const myBoletos = useMemo(() => 
    allBoletos.filter((b) => {
      if (b.resident_id && residentId) return b.resident_id === residentId;
      return compareUnits(b.unit, residentUnit);
    }),
    [allBoletos, residentId, residentUnit]
  );

  const myPackages = useMemo(
    () => allPackages.filter((p) => p.recipientId === residentId && !p.hiddenForResident),
    [allPackages, residentId]
  );

  const myReservations = useMemo(() => 
    allReservations.filter(r => r.unit && compareUnits(String(r.unit), residentUnit)),
    [allReservations, residentUnit]
  );

  const unreadNotices = useMemo(() => 
    allNotices.filter(n => !n.read).length,
    [allNotices]
  );

  const pendingBoletos = useMemo(() => 
    myBoletos.filter(b => b.status === 'Pendente' || b.status === 'Vencido'),
    [myBoletos]
  );

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">
          Olá, {currentResident.name}
        </h3>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">
          {formatUnit(currentResident.unit)}
        </p>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="premium-glass rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[var(--border-color)] hover:border-[var(--text-primary)]/30 transition-all cursor-pointer group" onClick={() => onViewNotice && allNotices.length > 0 && onViewNotice(allNotices[0])}>
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
            {unreadNotices > 0 && (
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white">
                {unreadNotices}
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-40 mb-0.5 sm:mb-1">Avisos</p>
          <p className="text-xl sm:text-2xl font-black">{unreadNotices}</p>
        </div>
        <div className="premium-glass rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[var(--border-color)] hover:border-[var(--text-primary)]/30 transition-all">
          <Receipt className="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2 opacity-40" />
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-40 mb-0.5 sm:mb-1">Boletos</p>
          <p className="text-xl sm:text-2xl font-black text-amber-400">{pendingBoletos.length}</p>
        </div>
        <div className="premium-glass rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[var(--border-color)] hover:border-[var(--text-primary)]/30 transition-all cursor-pointer group" onClick={() => onViewPackage && myPackages.filter(p => p.status === 'pendente').length > 0 && onViewPackage(myPackages.filter(p => p.status === 'pendente')[0])}>
          <Package className="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2 opacity-40 group-hover:opacity-100 transition-opacity" />
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-40 mb-0.5 sm:mb-1">Encomendas</p>
          <p className="text-xl sm:text-2xl font-black">{myPackages.filter(p => p.status === 'pendente').length}</p>
        </div>
        <div className="premium-glass rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[var(--border-color)] hover:border-[var(--text-primary)]/30 transition-all">
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2 opacity-40" />
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider opacity-40 mb-0.5 sm:mb-1">Reservas</p>
          <p className="text-xl sm:text-2xl font-black">{myReservations.length}</p>
        </div>
      </div>

      {/* Seções rápidas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Boletos Pendentes */}
        <div className="premium-glass rounded-2xl p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-black uppercase">Boletos Pendentes</h4>
            {pendingBoletos.length > 0 && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase rounded-full">
                {pendingBoletos.length}
              </span>
            )}
          </div>
          {pendingBoletos.length === 0 ? (
            <p className="text-xs opacity-40">Nenhum boleto pendente</p>
          ) : (
            <div className="space-y-2">
              {pendingBoletos.slice(0, 3).map(boleto => (
                <div key={boleto.id} className="flex justify-between items-center p-3 bg-[var(--glass-bg)] rounded-xl hover:bg-[var(--border-color)] transition-all group border border-[var(--border-color)]">
                  <div className="flex-1">
                    <p className="text-xs font-bold">{boleto.referenceMonth}</p>
                    <p className={`text-xs ${boleto.status === 'Vencido' ? 'text-red-400' : 'opacity-40'}`}>
                      Venc: {formatDate(boleto.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black">
                      {formatCurrency(boleto.amount)}
                    </p>
                    {(boleto.pdf_original_path || boleto.pdfUrl) && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onViewBoleto && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onViewBoleto(boleto); }}
                            className="p-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all"
                            style={{ color: 'var(--text-primary)' }}
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDownloadBoleto && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDownloadBoleto(boleto); }}
                            className="p-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--border-color)] transition-all"
                            style={{ color: 'var(--text-primary)' }}
                            title="Baixar"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Encomendas Pendentes */}
        <div className="premium-glass rounded-2xl p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-black uppercase">Encomendas Pendentes</h4>
            {myPackages.filter(p => p.status === 'pendente').length > 0 && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase rounded-full">
                {myPackages.filter(p => p.status === 'pendente').length}
              </span>
            )}
          </div>
          {myPackages.filter(p => p.status === 'pendente').length === 0 ? (
            <p className="text-xs opacity-40">Nenhuma encomenda pendente</p>
          ) : (
            <div className="space-y-2">
              {myPackages.filter(p => p.status === 'pendente').slice(0, 3).map(pkg => (
                <div 
                  key={pkg.id} 
                  className="flex justify-between items-center p-3 bg-[var(--glass-bg)] rounded-xl hover:bg-[var(--border-color)] transition-all cursor-pointer group border border-[var(--border-color)]"
                  onClick={() => onViewPackage && onViewPackage(pkg)}
                >
                  <div className="flex-1">
                    <p className="text-xs font-bold">{pkg.type}</p>
                    <p className="text-xs opacity-40">Recebido: {pkg.displayTime}</p>
                  </div>
                  <div className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase rounded-full">
                    Pendente
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Avisos Recentes */}
      {allNotices.length > 0 && (
        <div className="premium-glass rounded-2xl p-6 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-black uppercase">Avisos Recentes</h4>
            {unreadNotices > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-black uppercase rounded-full">
                {unreadNotices} não lidos
              </span>
            )}
          </div>
          <div className="space-y-2">
            {allNotices.slice(0, 3).map(notice => (
              <div 
                key={notice.id} 
                className={`p-3 rounded-xl transition-all cursor-pointer group ${
                  notice.read ? 'bg-[var(--glass-bg)]' : 'bg-[var(--border-color)] border border-[var(--border-color)]'
                } hover:bg-white/15`}
                onClick={() => onViewNotice && onViewNotice(notice)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-black">{notice.title}</p>
                      {!notice.read && (
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-xs opacity-60 line-clamp-2">{notice.content}</p>
                    <p className="text-[10px] opacity-40 mt-1">{formatDate(notice.date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoradorDashboardView;

