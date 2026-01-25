
import React, { useState, useMemo } from 'react';
import { Search, Download, Eye, CheckCircle2, Clock, AlertCircle, FileText, Calendar, DollarSign, Upload, Trash2 } from 'lucide-react';
import { Boleto, Resident } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';

interface BoletosViewProps {
  allBoletos: Boleto[];
  boletoSearch: string;
  setBoletoSearch: (val: string) => void;
  allResidents: Resident[];
  onViewBoleto?: (boleto: Boleto) => void;
  onDownloadBoleto?: (boleto: Boleto) => void;
  onDeleteBoleto?: (boleto: Boleto) => void;
  onImportClick?: () => void;
  showImportButton?: boolean;
}

const BoletosView: React.FC<BoletosViewProps> = ({
  allBoletos,
  boletoSearch,
  setBoletoSearch,
  allResidents,
  onViewBoleto,
  onDownloadBoleto,
  onDeleteBoleto,
  onImportClick,
  showImportButton = true
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Pago' | 'Vencido'>('all');

  const filteredBoletos = useMemo(() => {
    let filtered = allBoletos;

    // Filtro por busca
    if (boletoSearch) {
      const searchLower = boletoSearch.toLowerCase();
      filtered = filtered.filter(b => 
        b.residentName.toLowerCase().includes(searchLower) ||
        b.unit.toLowerCase().includes(searchLower) ||
        b.referenceMonth.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    // Ordenar: Vencidos primeiro, depois Pendentes, depois Pagos
    return filtered.sort((a, b) => {
      const statusOrder = { 'Vencido': 0, 'Pendente': 1, 'Pago': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // Se mesmo status, ordenar por data de vencimento (mais recente primeiro)
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });
  }, [allBoletos, boletoSearch, statusFilter]);

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

  const stats = useMemo(() => {
    const total = allBoletos.length;
    const pendentes = allBoletos.filter(b => b.status === 'Pendente').length;
    const pagos = allBoletos.filter(b => b.status === 'Pago').length;
    const vencidos = allBoletos.filter(b => b.status === 'Vencido').length;
    const totalAmount = allBoletos.reduce((sum, b) => sum + b.amount, 0);
    const pendenteAmount = allBoletos
      .filter(b => b.status === 'Pendente' || b.status === 'Vencido')
      .reduce((sum, b) => sum + b.amount, 0);

    return { total, pendentes, pagos, vencidos, totalAmount, pendenteAmount };
  }, [allBoletos]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Boletos</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Taxa de Condomínio</p>
        </div>
        {showImportButton && onImportClick && (
          <button 
            onClick={onImportClick} 
            className="px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2 hover:bg-[var(--border-color)]"
          >
            <Upload className="w-4 h-4" /> Importar Boletos
          </button>
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

      {/* Filtros e Busca */}
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

      {/* Lista de Boletos */}
      {filteredBoletos.length === 0 ? (
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
                        <h4 className="text-lg font-black uppercase tracking-tight">
                          {boleto.residentName}
                        </h4>
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
                      {boleto.pdfUrl && (
                        <>
                          {onViewBoleto && (
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
                              title="Baixar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </>
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

