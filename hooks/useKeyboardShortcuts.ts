import { useEffect } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface UseKeyboardShortcutsProps {
  onNavigate: (tab: string) => void;
}

export const useKeyboardShortcuts = ({ onNavigate }: UseKeyboardShortcutsProps) => {
  const { config } = useAppConfig();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      const shortcut = `${isMac ? 'Cmd' : 'Ctrl'}+${e.key.toUpperCase()}`;

      const shortcutConfig = config.keyboardShortcuts.find(
        s => s.key === shortcut || s.key === `Ctrl+${e.key.toUpperCase()}`
      );

      if (shortcutConfig) {
        e.preventDefault();
        onNavigate(shortcutConfig.action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.keyboardShortcuts, onNavigate]);
};

