import React, { useState } from 'react';
import { Keyboard, Save, Plus, X } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { KeyboardShortcut } from '../../contexts/AppConfigContext';

const KeyboardShortcutsSection: React.FC = () => {
  const { config, updateKeyboardShortcut } = useAppConfig();
  const [shortcuts, setShortcuts] = useState(config.keyboardShortcuts);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const actions = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'packages', label: 'Encomendas' },
    { value: 'visitors', label: 'Visitantes' },
    { value: 'occurrences', label: 'Ocorrências' },
    { value: 'notices', label: 'Mural' },
    { value: 'reservations', label: 'Reservas' },
    { value: 'residents', label: 'Moradores' },
    { value: 'ai', label: 'IA' },
    { value: 'settings', label: 'Configurações' }
  ];

  const handleSave = (index: number) => {
    updateKeyboardShortcut(index, shortcuts[index]);
    setEditingIndex(null);
  };

  const handleAdd = () => {
    const newShortcut: KeyboardShortcut = {
      key: 'Ctrl+N',
      action: 'dashboard',
      description: 'Nova ação'
    };
    setShortcuts([...shortcuts, newShortcut]);
    setEditingIndex(shortcuts.length);
  };

  const handleRemove = (index: number) => {
    setShortcuts(shortcuts.filter((_, i) => i !== index));
  };

  const parseKey = (keyString: string) => {
    const parts = keyString.split('+');
    return {
      modifier: parts[0],
      key: parts[1] || ''
    };
  };

  return (
    <div className="premium-glass rounded-[32px] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center border border-[var(--border-color)]">
          <Keyboard className="w-6 h-6 text-[var(--text-primary)]" />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight">Atalhos de Teclado</h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            Configure comandos rápidos para navegação
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {shortcuts.map((shortcut, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-4 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl"
          >
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                  Atalho
                </label>
                <input
                  type="text"
                  value={shortcut.key}
                  onChange={(e) => {
                    const newShortcuts = [...shortcuts];
                    newShortcuts[index].key = e.target.value;
                    setShortcuts(newShortcuts);
                  }}
                  placeholder="Ctrl+C"
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 text-sm font-mono"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                  Ação
                </label>
                <select
                  value={shortcut.action}
                  onChange={(e) => {
                    const newShortcuts = [...shortcuts];
                    newShortcuts[index].action = e.target.value;
                    setShortcuts(newShortcuts);
                  }}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {actions.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1 text-[var(--text-secondary)]">
                  Descrição
                </label>
                <input
                  type="text"
                  value={shortcut.description}
                  onChange={(e) => {
                    const newShortcuts = [...shortcuts];
                    newShortcuts[index].description = e.target.value;
                    setShortcuts(newShortcuts);
                  }}
                  placeholder="Descrição do atalho"
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(index)}
                className="p-2 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-lg transition-all hover:scale-110 active:scale-95"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRemove(index)}
                className="p-2 bg-red-500/20 text-red-500 rounded-lg transition-all hover:bg-red-500/30 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleAdd}
          className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wide">Adicionar Atalho</span>
        </button>
      </div>
    </div>
  );
};

export default KeyboardShortcutsSection;

