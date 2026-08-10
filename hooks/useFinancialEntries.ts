import { useState, useEffect } from 'react';
import Dexie from 'dexie';
import { FinancialEntry } from '../types';

// Database setup com tratamento de erro
let db: FinancialDatabase | null = null;

class FinancialDatabase extends Dexie {
  financialEntries: Dexie.Table<FinancialEntry, string>;

  constructor() {
    super('FinancialDatabase');
    this.version(1).stores({
      financialEntries: 'id, type, category, date, createdAt, referenceMonth'
    });
    this.financialEntries = this.table('financialEntries');
  }
}

// Função para obter instância do banco de dados com tratamento de erro
const getDatabase = (): FinancialDatabase => {
  if (!db) {
    try {
      db = new FinancialDatabase();
    } catch (error) {
      console.error('Erro ao criar instância do banco de dados FinancialDatabase:', error);
      throw new Error('Não foi possível inicializar o banco de dados local');
    }
  }
  return db;
};

export const useFinancialEntries = () => {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load entries from database
  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const database = getDatabase();
      const allEntries = await database.financialEntries.orderBy('date').reverse().toArray();
      setEntries(allEntries);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar entradas';
      console.error('Error loading financial entries:', error);
      setError(errorMessage);
      // Em caso de erro, definir array vazio para evitar crash
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entryData: Omit<FinancialEntry, 'id' | 'createdAt'>) => {
    try {
      const database = getDatabase();
      const newEntry: FinancialEntry = {
        ...entryData,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };

      await database.financialEntries.add(newEntry);
      await loadEntries(); // Reload to get updated data
      return newEntry;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar entrada';
      console.error('Error adding financial entry:', error);
      throw new Error(errorMessage);
    }
  };

  const updateEntry = async (id: string, updates: Partial<Omit<FinancialEntry, 'id' | 'createdAt'>>) => {
    try {
      const database = getDatabase();
      await database.financialEntries.update(id, updates);
      await loadEntries();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar entrada';
      console.error('Error updating financial entry:', error);
      throw new Error(errorMessage);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const database = getDatabase();
      await database.financialEntries.delete(id);
      await loadEntries();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir entrada';
      console.error('Error deleting financial entry:', error);
      throw new Error(errorMessage);
    }
  };

  const getEntriesByPeriod = (month: number, year: number) => {
    const referenceMonth = `${month.toString().padStart(2, '0')}/${year}`;
    return entries.filter(entry => entry.referenceMonth === referenceMonth);
  };

  const getTotalsByPeriod = (month: number, year: number) => {
    const periodEntries = getEntriesByPeriod(month, year);

    return periodEntries.reduce(
      (totals, entry) => {
        if (entry.type === 'receita') {
          totals.receitas += entry.amount;
        } else {
          totals.despesas += entry.amount;
        }
        totals.saldo = totals.receitas - totals.despesas;
        return totals;
      },
      { receitas: 0, despesas: 0, saldo: 0 }
    );
  };

  return {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntriesByPeriod,
    getTotalsByPeriod,
    loadEntries
  };
};