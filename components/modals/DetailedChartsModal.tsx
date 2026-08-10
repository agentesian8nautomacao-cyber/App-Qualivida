import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { X, TrendingUp, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { Boleto } from '../../types';

interface DetailedChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allBoletos: Boleto[];
  periodFilter: 'mes' | 'trimestre' | 'ano' | 'mes_especifico' | 'total';
  selectedMonth?: number;
  selectedYear?: number;
}

const COLORS = {
  receita: '#10b981',
  despesa: '#ef4444',
  condominio: '#3b82f6',
  agua: '#06b6d4',
  luz: '#eab308',
  pagos: '#10b981',
  pendentes: '#f59e0b',
  vencidos: '#ef4444'
};

const DetailedChartsModal: React.FC<DetailedChartsModalProps> = ({
  isOpen,
  onClose,
  allBoletos,
  periodFilter,
  selectedMonth = new Date().getMonth(),
  selectedYear = new Date().getFullYear()
}) => {
  // Processar dados para os gráficos
  const chartData = useMemo(() => {
    // Filtrar boletos por período
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredBoletos = allBoletos.filter(boleto => {
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

    // Dados para gráfico de evolução temporal (últimos 12 meses)
    const monthlyEvolution = filteredBoletos.reduce((acc, boleto) => {
      const date = new Date(boleto.dueDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthName,
          fullDate: date,
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
    }, {} as Record<string, any>);

    const evolutionData = Object.entries(monthlyEvolution)
      .sort(([,a], [,b]) => a.fullDate - b.fullDate)
      .slice(-12)
      .map(([, data]) => data);

    // Dados para distribuição por tipo
    const typeDistribution = filteredBoletos
      .filter(b => b.status === 'Pago')
      .reduce((acc, boleto) => {
        const tipo = boleto.boletoType || 'condominio';
        acc[tipo] = (acc[tipo] || 0) + boleto.amount;
        return acc;
      }, {} as Record<string, number>);

    const pieData = Object.entries(typeDistribution).map(([name, value]) => ({
      name: name === 'condominio' ? 'Condomínio' : name === 'agua' ? 'Água' : 'Luz',
      value,
      color: COLORS[name as keyof typeof COLORS]
    }));

    // Dados para status dos boletos
    const statusData = [
      { name: 'Pagos', value: filteredBoletos.filter(b => b.status === 'Pago').length, color: COLORS.pagos },
      { name: 'Pendentes', value: filteredBoletos.filter(b => b.status === 'Pendente').length, color: COLORS.pendentes },
      { name: 'Vencidos', value: filteredBoletos.filter(b => b.status === 'Vencido').length, color: COLORS.vencidos }
    ].filter(item => item.value > 0);

    // Dados para comparação mensal (últimos 6 meses)
    const monthlyComparison = evolutionData.slice(-6).map(data => ({
      month: data.month,
      receita: data.receita,
      despesa: data.despesa,
      saldo: data.receita - data.despesa
    }));

    return {
      evolutionData,
      pieData,
      statusData,
      monthlyComparison
    };
  }, [allBoletos, periodFilter]);

  if (!isOpen) return null;

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const formatTooltipCurrency = (value: any, name: string) => [
    formatCurrency(value),
    name === 'receita' ? 'Receita' : name === 'despesa' ? 'Despesa' : name === 'saldo' ? 'Saldo' : name
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-7xl max-h-[90vh] overflow-y-auto bg-[var(--bg-color)] rounded-2xl border border-[var(--border-color)] shadow-2xl animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6" />
            <h2 className="text-xl font-black uppercase tracking-tight">Gráficos Detalhados</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-8">
          {/* Gráfico de Evolução Temporal */}
          <div className="premium-glass rounded-xl p-6 border border-[var(--border-color)]">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5" />
              <h3 className="text-lg font-black uppercase tracking-tight">Evolução Temporal</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--text-primary)"
                    opacity={0.7}
                    fontSize={12}
                  />
                  <YAxis
                    stroke="var(--text-primary)"
                    opacity={0.7}
                    fontSize={12}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                    formatter={formatTooltipCurrency}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="receita"
                    stackId="1"
                    stroke={COLORS.receita}
                    fill={COLORS.receita}
                    fillOpacity={0.6}
                    name="Receita"
                  />
                  <Area
                    type="monotone"
                    dataKey="despesa"
                    stackId="2"
                    stroke={COLORS.despesa}
                    fill={COLORS.despesa}
                    fillOpacity={0.6}
                    name="Despesa"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gráfico de Barras - Comparação Mensal */}
            <div className="premium-glass rounded-xl p-6 border border-[var(--border-color)]">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-tight">Comparação Mensal</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.monthlyComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                    <XAxis
                      dataKey="month"
                      stroke="var(--text-primary)"
                      opacity={0.7}
                      fontSize={12}
                    />
                    <YAxis
                      stroke="var(--text-primary)"
                      opacity={0.7}
                      fontSize={12}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px'
                      }}
                      formatter={formatTooltipCurrency}
                    />
                    <Legend />
                    <Bar dataKey="receita" fill={COLORS.receita} name="Receita" />
                    <Bar dataKey="despesa" fill={COLORS.despesa} name="Despesa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Pizza - Distribuição por Tipo */}
            <div className="premium-glass rounded-xl p-6 border border-[var(--border-color)]">
              <div className="flex items-center gap-3 mb-6">
                <PieChartIcon className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-tight">Distribuição por Tipo</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Gráfico de Linha - Tendência de Status */}
          <div className="premium-glass rounded-xl p-6 border border-[var(--border-color)]">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5" />
              <h3 className="text-lg font-black uppercase tracking-tight">Tendência de Status dos Boletos</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--text-primary)"
                    opacity={0.7}
                    fontSize={12}
                  />
                  <YAxis
                    stroke="var(--text-primary)"
                    opacity={0.7}
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="boletosPagos"
                    stroke={COLORS.pagos}
                    strokeWidth={2}
                    name="Pagos"
                  />
                  <Line
                    type="monotone"
                    dataKey="boletosPendentes"
                    stroke={COLORS.pendentes}
                    strokeWidth={2}
                    name="Pendentes"
                  />
                  <Line
                    type="monotone"
                    dataKey="boletosVencidos"
                    stroke={COLORS.vencidos}
                    strokeWidth={2}
                    name="Vencidos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedChartsModal;