
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Lock, Eye, EyeOff, Sun, Moon, Building2, Briefcase, ChevronRight, LogIn, X, Shield } from 'lucide-react';
import { UserRole } from '../types';
import { loginUser, saveUserSession } from '../services/userAuth';
import ForgotPassword from './ForgotPassword';
import { BRANDING } from '../config/branding';

export interface LoginProps {
  onLogin: (role: UserRole, options?: { mustChangePassword?: boolean }) => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, theme = 'dark', toggleTheme }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('PORTEIRO');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryLinkExpired, setRecoveryLinkExpired] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoginModalClosing, setIsLoginModalClosing] = useState(false);
  // Slider "Iniciar Turno" (estilo LandingPage)
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const accessButtonRef = useRef<HTMLButtonElement>(null);

  const openLoginModal = () => {
    setIsLoginModalClosing(false);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = useCallback(() => {
    setIsLoginModalClosing(true);
    window.setTimeout(() => {
      setIsLoginModalOpen(false);
      setIsLoginModalClosing(false);
      accessButtonRef.current?.focus();
    }, 160);
  }, []);

  useEffect(() => {
    if (!isLoginModalOpen || isLoginModalClosing) return;
    const timer = window.setTimeout(() => usernameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isLoginModalOpen, isLoginModalClosing]);

  useEffect(() => {
    if (!isLoginModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLoginModal();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isLoginModalOpen, closeLoginModal]);

  const handleModalKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !modalRef.current) return;
    const focusable = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    const isResetPath = window.location.pathname === '/reset-password';

    // Supabase Auth pode redirecionar com erro no hash: #error=access_denied&error_code=otp_expired
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const errorCode = hashParams.get('error_code') || hashParams.get('error');
    const otpExpired = errorCode === 'otp_expired' || (hashParams.get('error_description') || '').toLowerCase().includes('expired');
    if (hash && (otpExpired || errorCode === 'access_denied')) {
      setRecoveryLinkExpired(true);
      setShowForgotPassword(true);
      window.history.replaceState({}, '', window.location.pathname || '/');
    }

    // Link válido de recuperação: /reset-password#type=recovery&access_token=... → abrir modal de redefinir senha
    const isRecoveryLink = hash.includes('type=recovery') && !hashParams.get('error');
    if ((isResetPath || isRecoveryLink) && !hashParams.get('error')) {
      setShowForgotPassword(true);
    }

  }, []);

  // Aplicar tema no body quando o componente montar ou tema mudar
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    return () => {
      // Não remover a classe ao desmontar, pois pode estar sendo usada pelo app principal
    };
  }, [theme]);

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setUsername('');
    setPassword('');
    setError(null);
  };

  // Resetar slider quando houver erro
  useEffect(() => {
    if (error) setSliderPosition(0);
  }, [error]);

  // Slider "Iniciar Turno" - handlers (estilo LandingPage)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (loading) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current || loading) return;
    const rect = trackRef.current.getBoundingClientRect();
    const knobWidth = 80;
    const maxPos = rect.width - knobWidth - 16;
    let newPos = e.clientX - rect.left - knobWidth / 2;
    if (newPos < 0) newPos = 0;
    if (newPos > maxPos) newPos = maxPos;
    setSliderPosition(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!trackRef.current || loading) return;

    const rect = trackRef.current.getBoundingClientRect();
    const knobWidth = 80;
    const maxPos = rect.width - knobWidth - 16;

    if (sliderPosition >= maxPos * 0.85) {
      setSliderPosition(maxPos);
      if (navigator.vibrate) navigator.vibrate(50);
      handleLogin();
    } else {
      setSliderPosition(0);
    }
  };

  const handleLogin = useCallback(async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    
    setError(null);
    
    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha usuário e senha');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await loginUser(username.trim(), password, selectedRole);
      
      if (!result.user) {
        // Verificar se está bloqueado
        if (result.blocked) {
          setError(result.error || 'Conta bloqueada');
          setLoading(false);
          return;
        }
        
        // Mostrar erro e informações de tentativas
        setError(result.error || 'Usuário ou senha inválidos');
        setLoading(false);
        return;
      }

      // Não exigir correspondência entre selectedRole e role retornado.
      // Adotar o papel retornado pelo perfil do usuário e prosseguir.
      try { setSelectedRole(result.user.role as UserRole); } catch {}

      // Salvar sessão
      saveUserSession(result.user);

      // Delay para feedback visual — informar papel real do usuário ao onLogin
      setTimeout(() => {
        onLogin(result.user.role as UserRole, { mustChangePassword: !!(result as { mustChangePassword?: boolean }).mustChangePassword });
      }, 500);
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Erro ao conectar com o servidor. Tente novamente.');
      setLoading(false);
    }
  }, [selectedRole, username, password, loading, onLogin]);

  // Enter submete o formulário (handler estável para evitar submissão dupla)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && showForm && isLoginModalOpen && !loading) handleLogin();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showForm, isLoginModalOpen, loading, handleLogin]);

  // Se mostrar recuperação de senha
  if (showForgotPassword) {
    return (
      <div className={`sentinela-login-page relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500 ${theme === 'light' ? 'light-mode' : ''}`}>
        <div className="sentinela-login-overlay" aria-hidden="true" />
        {toggleTheme && (
          <button
            onClick={toggleTheme}
            className="sentinela-access-theme-toggle"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
        <ForgotPassword
          onBack={() => { setShowForgotPassword(false); setRecoveryLinkExpired(false); }}
          theme={theme}
          recoveryLinkExpiredMessage={recoveryLinkExpired ? 'Este link expirou ou já foi usado. Solicite um novo link abaixo (use o mesmo e-mail).' : undefined}
        />
      </div>
    );
  }

  return (
    <div className={`sentinela-login-page relative min-h-screen w-full overflow-hidden transition-colors duration-500 ${theme === 'light' ? 'light-mode' : ''}`}>
      <div className="sentinela-login-overlay" aria-hidden="true" />
      {toggleTheme && (
        <button
          onClick={toggleTheme}
          className="sentinela-access-theme-toggle"
          title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      )}

      <main className="sentinela-access-stage relative z-10">
        <button
          ref={accessButtonRef}
          type="button"
          onClick={openLoginModal}
          className="sentinela-access-button"
        >
          <span>Acessar Painel Operacional</span>
          <LogIn className="w-5 h-5" aria-hidden="true" />
        </button>
      </main>

      {isLoginModalOpen && (
        <div
          className={`sentinela-login-modal-backdrop ${isLoginModalClosing ? 'is-closing' : ''}`}
          onMouseDown={closeLoginModal}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="operational-login-title"
            className={`sentinela-login-modal ${isLoginModalClosing ? 'is-closing' : ''}`}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={handleModalKeyDown}
          >
            <div className="sentinela-card sentinela-login-card w-full border rounded-[32px] p-6 sm:p-8 relative overflow-hidden group transition-all duration-500">
              <button
                type="button"
                onClick={closeLoginModal}
                className="sentinela-login-modal-close"
                aria-label="Fechar acesso ao painel"
              >
                <X className="w-5 h-5" />
              </button>
          <div className="relative z-10">
            <header className="mb-7 pr-14">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--sentinela-accent)] mb-2">
                Sistema operacional
              </p>
              <h1 id="operational-login-title" className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--sentinela-text)]">
                {BRANDING.name}
              </h1>
              <p className="text-sm font-semibold text-[var(--sentinela-text-muted)] mt-1">
                Acesso ao Painel Operacional
              </p>
            </header>

            {/* Perfis operacionais existentes; o papel efetivo continua vindo da autenticação. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-7" aria-label="Perfil de acesso">
              <button 
                type="button"
                onClick={() => handleRoleChange('PORTEIRO')}
                aria-pressed={selectedRole === 'PORTEIRO'}
                className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  selectedRole === 'PORTEIRO'
                    ? theme === 'light'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.15)]'
                      : 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                    : theme === 'light'
                      ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <User size={24} className={selectedRole === 'PORTEIRO' ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Portaria</span>
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('SINDICO')}
                aria-pressed={selectedRole === 'SINDICO'}
                className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  selectedRole === 'SINDICO'
                    ? theme === 'light'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.15)]'
                      : 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                    : theme === 'light'
                      ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <Briefcase size={24} className={selectedRole === 'SINDICO' ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Síndico</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('ADMINISTRADORA')}
                aria-pressed={selectedRole === 'ADMINISTRADORA'}
                className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  selectedRole === 'ADMINISTRADORA'
                    ? theme === 'light'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-700 shadow-[0_0_20px_rgba(37,99,235,0.15)]'
                      : 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                    : theme === 'light'
                      ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <Building2 size={24} className={selectedRole === 'ADMINISTRADORA' ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                  Administradora
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.assign('/master/login');
                }}
                className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  theme === 'light'
                    ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                    : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <Shield size={24} className="group-hover:scale-110 transition-transform" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-center leading-tight">
                  Master
                </span>
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Mensagem de erro */}
              {error && (
                <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                  theme === 'light'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="relative">
                  <label htmlFor="operational-username" className="sr-only">Usuário</label>
                  <User className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                  }`} />
                  <input 
                    ref={usernameInputRef}
                    id="operational-username"
                    type="text" 
                    placeholder="Usuário ou e-mail"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    autoComplete="username"
                    className="sentinela-input w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium placeholder:text-[var(--sentinela-text-muted)]"
                    required
                  />
                </div>
                <div className="relative">
                  <label htmlFor="operational-password" className="sr-only">Senha</label>
                  <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                  }`} />
                  <input 
                    id="operational-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Senha" 
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null); // Limpar erro ao digitar
                    }}
                    autoComplete="current-password"
                    className="sentinela-input w-full pl-8 pr-12 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium placeholder:text-[var(--sentinela-text-muted)]"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 transition-colors ${
                      theme === 'light' ? 'text-gray-400 hover:text-gray-600' : 'text-zinc-600 hover:text-white'
                    }`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Slider "Iniciar Turno" (estilo LandingPage) */}
              <div 
                ref={trackRef}
                className={`relative rounded-[2.5rem] h-20 shadow-2xl border max-w-sm mx-auto overflow-hidden touch-none ${
                  theme === 'light'
                    ? 'bg-gray-200/80 border-gray-300/50'
                    : 'bg-[var(--sentinela-surface-elevated)] border-[var(--sentinela-border)]'
                }`}
              >
                <div 
                  className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300"
                  style={{ opacity: Math.max(0, 1 - sliderPosition / 150), paddingLeft: '60px' }}
                >
                  <span className={`font-medium text-xs tracking-[0.3em] uppercase animate-pulse ${
                    theme === 'light' ? 'text-gray-600' : 'text-white/40'
                  }`}>
                    {loading ? 'Entrando...' : 'Deslize para entrar'}
                  </span>
                  <div className={`absolute right-6 opacity-30 ${theme === 'light' ? 'text-gray-600' : 'text-white'}`}>
                    <ChevronRight size={18} />
                  </div>
                </div>
                <div 
                  className={`absolute top-2 left-2 h-16 w-20 rounded-[2rem] flex items-center justify-center cursor-grab active:cursor-grabbing z-20 group transition-colors duration-300 ${
                    loading
                      ? theme === 'light'
                        ? 'bg-gray-400 text-white'
                        : 'bg-white/50 text-black'
                      : 'sentinela-primary-action'
                  }`}
                  style={{ 
                    transform: `translateX(${sliderPosition}px)`, 
                    transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <div className="group-active:scale-110 transition-transform">
                    {loading ? (
                      <div className={`w-6 h-6 border-2 rounded-full animate-spin ${
                        theme === 'light' ? 'border-white/20 border-t-white' : 'border-black/20 border-t-black'
                      }`} />
                    ) : (
                      <ChevronRight size={24} strokeWidth={3} />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className={`text-sm text-center underline transition-colors ${
                    theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};

export default Login;
