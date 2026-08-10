import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { syncOutbox } from '../services/offlineDataService';

type ConnectivityContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
};

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      await syncOutbox();
    } catch (err) {
      console.warn('[Connectivity] Erro ao sincronizar', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      runSync();
    }

    const interval = window.setInterval(() => {
      if (navigator.onLine) runSync();
    }, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [runSync]);

  return (
    <ConnectivityContext.Provider value={{ isOnline, isSyncing, triggerSync: runSync }}>
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

