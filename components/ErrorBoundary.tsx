import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] ERRO CAPTURADO:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#09090b] text-white">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">
                Algo deu errado
              </h1>
              <p className="text-sm text-zinc-500 mt-2">
                Ocorreu um erro inesperado. Você pode tentar novamente ou recarregar a página.
              </p>
              {this.state.error && import.meta.env?.DEV && (
                <pre className="text-left text-xs bg-black/40 p-3 rounded-lg overflow-auto max-h-32 mt-2">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-zinc-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 border border-white/10"
              >
                <Home className="w-4 h-4" /> Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
