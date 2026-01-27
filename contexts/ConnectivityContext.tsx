import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncOutbox } from '../services/offlineDataService';

type ConnectivityContextValue = {
  isOnline: boolean;
};

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Ao voltar online, dispara sincronização da outbox
      syncOutbox().catch((err) => {
        console.warn('[Connectivity] Erro ao sincronizar ao voltar online', err);
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ao montar o app, tentar uma sincronização inicial (se já estiver online)
    if (navigator.onLine) {
      syncOutbox().catch((err) => {
        console.warn('[Connectivity] Erro ao sincronizar na inicialização', err);
      });
    }

    // Sync periódico a cada alguns minutos enquanto o app estiver aberto e online
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        syncOutbox().catch((err) => {
          console.warn('[Connectivity] Erro ao sincronizar em intervalo', err);
        });
      }
    }, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline }}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = (): ConnectivityContextValue => {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error('useConnectivity deve ser usado dentro de ConnectivityProvider');
  }
  return ctx;
};

