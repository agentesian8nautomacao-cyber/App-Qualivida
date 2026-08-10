import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_TTL_MS = 5000;
const MAX_TOASTS = 3;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: ToastItem = { id, type, message, createdAt: Date.now() };
    setToasts((prev) => {
      const next = [...prev, item].slice(-MAX_TOASTS);
      return next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  const success = useCallback((message: string) => add('success', message), [add]);
  const error = useCallback((message: string) => add('error', message), [add]);
  const info = useCallback((message: string) => add('info', message), [add]);
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, success, error, info, dismiss }}>
      {children}
      <ToastList />
    </ToastContext.Provider>
  );
};

function ToastList() {
  const { toasts, dismiss } = useContext(ToastContext)!;
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const bg = item.type === 'error' ? 'bg-red-600' : item.type === 'success' ? 'bg-green-600' : 'bg-zinc-700';
  return (
    <div
      role="alert"
      className={`${bg} text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-right-4 duration-300 flex items-start justify-between gap-3`}
    >
      <p className="flex-1 break-words">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
