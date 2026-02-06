
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, User, Lock, Eye, EyeOff, Sun, Moon, Building2, Briefcase, ChevronRight } from 'lucide-react';
import { UserRole } from '../types';
import { loginUser, saveUserSession } from '../services/userAuth';
import ForgotPassword from './ForgotPassword';

export interface LoginProps {
  onLogin: (role: UserRole, options?: { mustChangePassword?: boolean }) => void;
  onMoradorLogin?: (unit: string, password: string) => Promise<void>;
  onRequestResidentRegister?: () => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onMoradorLogin, onRequestResidentRegister, theme = 'dark', toggleTheme }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('PORTEIRO');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetFromLink, setResetFromLink] = useState<{ token: string } | null>(null);
  const [recoveryLinkExpired, setRecoveryLinkExpired] = useState(false);
  // Slider "Iniciar Turno" (estilo LandingPage)
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const reset = params.get('reset');
    const isResetPath = window.location.pathname === '/reset-password';
    const isResidentLink = params.get('resident') === 'true' || params.get('morador') === 'true';

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

    // Aceita tanto o padrão antigo (?reset=1&token=) quanto o novo (/reset-password?token=)
    if (token && (reset === '1' || isResetPath)) {
      setResetFromLink({ token });
      setShowForgotPassword(true);
      setSelectedRole('PORTEIRO');
      window.history.replaceState({}, '', '/');
    } else if (isResidentLink) {
      setSelectedRole('MORADOR');
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
      setError(selectedRole === 'MORADOR' ? 'Por favor, preencha unidade e senha' : 'Por favor, preencha usuário e senha');
      return;
    }

    // Login do morador: Unidade + Senha → onMoradorLogin (cadastro só via "Criar conta")
    if (selectedRole === 'MORADOR') {
      if (!onMoradorLogin) {
        setError('Login de morador indisponível.');
        return;
      }
      setLoading(true);
      try {
        await onMoradorLogin(username.trim(), password);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unidade ou senha incorretos');
      } finally {
        setLoading(false);
      }
      return;
    }
    
    setLoading(true);
    
    try {
      // Validar credenciais no Supabase (agora retorna objeto com mais informações)
      const result = await loginUser(username.trim(), password);
      
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

      // Verificar se o role do usuário corresponde ao selecionado
      if (result.user.role !== selectedRole) {
        setError(`Este usuário é ${result.user.role === 'PORTEIRO' ? 'Porteiro' : 'Síndico'}. Selecione o papel correto.`);
        setLoading(false);
        return;
      }

      // Salvar sessão
      saveUserSession(result.user);

      // Delay para feedback visual
      setTimeout(() => {
        onLogin(selectedRole, { mustChangePassword: !!(result as { mustChangePassword?: boolean }).mustChangePassword });
      }, 500);
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Erro ao conectar com o servidor. Tente novamente.');
      setLoading(false);
    }
  }, [selectedRole, username, password, loading, onLogin, onMoradorLogin]);

  // Enter submete o formulário (handler estável para evitar submissão dupla)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && showForm && !loading) handleLogin();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showForm, loading, handleLogin]);

  // Se mostrar recuperação de senha (Porteiro, Síndico ou Morador)
  if (showForgotPassword) {
    return (
      <div className={`relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500 ${
        theme === 'light' ? 'bg-gray-50' : 'bg-[#050505]'
      }`}>
        <ForgotPassword
          onBack={() => { setShowForgotPassword(false); setResetFromLink(null); setRecoveryLinkExpired(false); }}
          theme={theme}
          initialToken={resetFromLink?.token}
          initialStep={resetFromLink ? 'reset' : undefined}
          isResident={selectedRole === 'MORADOR'}
          recoveryLinkExpiredMessage={recoveryLinkExpired ? 'Este link expirou ou já foi usado. Solicite um novo link abaixo (use o mesmo e-mail).' : undefined}
        />
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500 ${
      theme === 'light' ? 'bg-gray-50' : 'bg-[#050505]'
    }`}>
      {/* Intro removida - vídeo já foi exibido */}
      
      <div className="relative z-10 w-full max-w-md p-4 opacity-100">
        <div className={`backdrop-blur-3xl border rounded-[48px] p-8 md:p-12 shadow-2xl relative overflow-hidden group transition-all duration-500 ${
          theme === 'light' 
            ? 'bg-white border-gray-200/50' 
            : 'bg-white/[0.03] border-white/10'
        }`}>
          
          {/* Botão de alternar tema */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className={`absolute top-6 right-6 p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center z-20 ${
                theme === 'light'
                  ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
          
          <div className="relative z-10">
            <header className="flex flex-col items-center justify-center mb-12">
              {/* Logo do Condomínio */}
              <div className="relative flex-shrink-0 mb-4">
                <div className={`absolute inset-0 rounded-2xl blur-xl transition-all ${
                  theme === 'light' ? 'bg-gray-200' : 'bg-white/10'
                }`} />
                <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden transition-all ${
                  theme === 'light' ? 'bg-white border border-gray-200' : 'bg-white'
                }`}>
                  <img 
                    src="/1024.png" 
                    alt="Logo Qualivida"
                    className="w-full h-full object-contain p-1.5"
                    onError={(e) => {
                      // Fallback para ícone ShieldCheck se a imagem não carregar
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('svg')) {
                        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        svg.setAttribute('class', `w-8 h-8 ${theme === 'light' ? 'text-gray-800' : 'text-black'}`);
                        svg.setAttribute('fill', 'none');
                        svg.setAttribute('viewBox', '0 0 24 24');
                        svg.setAttribute('stroke', 'currentColor');
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('stroke-linecap', 'round');
                        path.setAttribute('stroke-linejoin', 'round');
                        path.setAttribute('stroke-width', '2');
                        path.setAttribute('d', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z');
                        svg.appendChild(path);
                        parent.appendChild(svg);
                      }
                    }}
                  />
                </div>
              </div>
              <p className={`text-[10px] uppercase tracking-[0.3em] font-black ${
                theme === 'light' ? 'text-gray-500' : 'text-zinc-500'
              }`}>Qualivida Gestão</p>
            </header>

            {/* Seletor de perfil - estilo LandingPage (modal Controle de Acesso) */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <button 
                type="button"
                onClick={() => handleRoleChange('MORADOR')}
                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  selectedRole === 'MORADOR'
                    ? theme === 'light'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-600 shadow-[0_0_20px_rgba(14,165,233,0.15)]'
                      : 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.1)]'
                    : theme === 'light'
                      ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <Building2 size={24} className={selectedRole === 'MORADOR' ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-xs font-bold uppercase tracking-wider">Morador</span>
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('PORTEIRO')}
                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  selectedRole === 'PORTEIRO'
                    ? theme === 'light'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                    : theme === 'light'
                      ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <User size={24} className={selectedRole === 'PORTEIRO' ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-xs font-bold uppercase tracking-wider">Portaria</span>
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('SINDICO')}
                className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                  selectedRole === 'SINDICO'
                    ? theme === 'light'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                    : theme === 'light'
                      ? 'bg-gray-100/80 border-gray-200/50 text-gray-500 hover:bg-gray-200/80'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <Briefcase size={24} className={selectedRole === 'SINDICO' ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="text-xs font-bold uppercase tracking-wider">Síndico</span>
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
                  {selectedRole === 'MORADOR' ? (
                    <Building2 className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                  ) : (
                    <User className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                  )}
                  <input 
                    type="text" 
                    placeholder={selectedRole === 'MORADOR' ? 'Unidade (ex: 03/005, 3/5)' : 'Usuário'} 
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    autoComplete={selectedRole === 'MORADOR' ? 'username' : 'username'}
                    className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                      theme === 'light'
                        ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                        : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                    }`}
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                  }`} />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Senha" 
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null); // Limpar erro ao digitar
                    }}
                    autoComplete="current-password"
                    className={`w-full pl-8 pr-12 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                      theme === 'light'
                        ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                        : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                    }`}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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
                    : 'bg-[#18181B] border-white/5'
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
                      : selectedRole === 'SINDICO'
                        ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                        : selectedRole === 'PORTEIRO'
                          ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                          : theme === 'light'
                            ? 'bg-gray-900 text-white shadow-[0_0_20px_rgba(0,0,0,0.2)]'
                            : 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]'
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

              {/* Morador: cadastro + esqueci senha; Porteiro/Síndico: esqueci senha */}
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
                {selectedRole === 'MORADOR' && onRequestResidentRegister && (
                  <button
                    type="button"
                    onClick={onRequestResidentRegister}
                    className={`text-sm text-center underline transition-colors ${
                      theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Não tem cadastro? Criar conta
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
