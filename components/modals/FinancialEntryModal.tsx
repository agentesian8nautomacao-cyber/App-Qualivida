import React, { useState } from 'react';
import { X, DollarSign, Calendar, FileText, Tag } from 'lucide-react';
import { FinancialEntry, FinancialEntryType } from '../../types';

interface FinancialEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<FinancialEntry, 'id' | 'createdAt'>) => void;
  type: FinancialEntryType;
  editEntry?: FinancialEntry | null;
}

const RECEITA_CATEGORIES = [
  'Aluguéis',
  'Multas',
  'Juros',
  'Reembolsos',
  'Doações',
  'Eventos',
  'Outros'
];

const DESPESA_CATEGORIES = [
  'Manutenção',
  'Limpeza',
  'Materiais',
  'Segurança',
  'Água',
  'Luz',
  'Internet',
  'Administrativos',
  'Imprevistos',
  'Outros'
];

const FinancialEntryModal: React.FC<FinancialEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type,
  editEntry
}) => {
  // Verificar se a categoria editada está nas categorias pré-definidas
  const isCustomCategory = editEntry?.category && ![...RECEITA_CATEGORIES, ...DESPESA_CATEGORIES].includes(editEntry.category);

  const [category, setCategory] = useState(isCustomCategory ? '' : (editEntry?.category || ''));
  const [customCategory, setCustomCategory] = useState(isCustomCategory ? (editEntry?.category || '') : '');
  const [useCustomCategory, setUseCustomCategory] = useState(isCustomCategory);
  const [description, setDescription] = useState(editEntry?.description || '');
  const [amount, setAmount] = useState(editEntry?.amount?.toString() || '');
  const [date, setDate] = useState(editEntry?.date ? editEntry.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [createdBy, setCreatedBy] = useState(editEntry?.createdBy || 'Síndico');

  const categories = type === 'receita' ? RECEITA_CATEGORIES : DESPESA_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalCategory = useCustomCategory ? customCategory.trim() : category;

    if (!finalCategory || !description || !amount || !date) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (useCustomCategory && finalCategory === '') {
      alert('Digite o nome da categoria personalizada');
      return;
    }

    const entry: Omit<FinancialEntry, 'id' | 'createdAt'> = {
      type,
      category: finalCategory,
      description,
      amount: parseFloat(amount.replace(',', '.')),
      date: new Date(date).toISOString(),
      createdBy,
      referenceMonth: new Date(date).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
    };

    onSave(entry);
    handleClose();
  };

  const handleClose = () => {
    setCategory('');
    setCustomCategory('');
    setUseCustomCategory(false);
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setCreatedBy('Síndico');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--bg-color)] rounded-2xl border border-[var(--border-color)] shadow-2xl animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${type === 'receita' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <DollarSign className={`w-5 h-5 ${type === 'receita' ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">
                {editEntry ? 'Editar' : 'Nova'} {type === 'receita' ? 'Receita' : 'Despesa'}
              </h2>
              <p className="text-sm opacity-70">
                {editEntry ? 'Modificar entrada financeira' : 'Registrar entrada manual'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Categoria *
            </label>
            <select
              value={useCustomCategory ? 'outra' : category}
              onChange={(e) => {
                if (e.target.value === 'outra') {
                  setUseCustomCategory(true);
                  setCategory('');
                } else {
                  setUseCustomCategory(false);
                  setCategory(e.target.value);
                  setCustomCategory('');
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]"
              required
            >
              <option value="">Selecione uma categoria</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="outra">Outra...</option>
            </select>
          </div>

          {/* Campo para categoria customizada */}
          {useCustomCategory && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Nome da Categoria *
              </label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]"
                placeholder="Digite o nome da categoria"
                required
              />
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descrição *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)] resize-none"
              rows={3}
              placeholder="Descreva a receita/despesa..."
              required
            />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]"
              placeholder="0,00"
              required
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]"
              required
            />
          </div>

          {/* Criado por */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Registrado por
            </label>
            <input
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]"
              placeholder="Nome do responsável"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 rounded-lg text-[var(--bg-color)] font-medium transition-colors ${
                type === 'receita'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {editEntry ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FinancialEntryModal;