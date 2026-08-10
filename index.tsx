import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import * as Sentry from '@sentry/react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Aplicar tema inicial
const savedConfig = localStorage.getItem('app_config');
if (savedConfig) {
  try {
    const config = JSON.parse(savedConfig);
    if (config.theme) {
      document.documentElement.setAttribute('data-theme', config.theme);
    }
  } catch {
    // Ignorar erro
  }
}

// Monitoramento de erros (LGPD/Operação): habilita somente quando houver DSN configurado e válido.
// DSN válido é uma URL do Sentry (ex: https://xxx@xxx.ingest.sentry.io/xxx). Não usar o comando do wizard como DSN.
try {
  const raw = (import.meta as any)?.env?.VITE_SENTRY_DSN ? String((import.meta as any).env.VITE_SENTRY_DSN).trim() : '';
  const isValidDsn = raw.length > 0 && /^https?:\/\//.test(raw) && raw.includes('sentry');
  const dsn = isValidDsn ? raw : '';
  Sentry.init({
    dsn: dsn || undefined,
    enabled: !!dsn,
    environment: (import.meta as any)?.env?.MODE ? String((import.meta as any).env.MODE) : undefined,
    tracesSampleRate: 0,
  });
  if (dsn) {
    Sentry.setTag('app', 'gestao-qualivida-residence');
  }
} catch {
  // best-effort: não impedir bootstrap do app
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppConfigProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </AppConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
