
import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, User, Lock, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { UserRole } from '../types';
import { loginUser, saveUserSession } from '../services/userAuth';

interface LoginProps {
  onLogin: (role: UserRole) => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, theme = 'dark', toggleTheme }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('PORTEIRO');
  const [username, setUsername] = useState('portaria');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Intro removida - o vídeo já foi exibido antes
  // useEffect(() => {
  //   const introTimer = setTimeout(() => {
  //     setShowIntro(false);
  //     setShowForm(true);
  //   }, 2800); 
  //   return () => clearTimeout(introTimer);
  // }, []);

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

  // Adiciona listener global para tecla Enter (atalho para computadores)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && showForm && !loading) {
        handleLogin();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showForm, loading, selectedRole, username, password]);

  const handleRoleChange = (role: UserRole) => {
    // Garantir que apenas um role seja selecionado por vez
    setSelectedRole(role);
    if (role === 'PORTEIRO') {
      setUsername('portaria');
      setPassword('123456');
    } else if (role === 'SINDICO') {
      setUsername('admin');
      setPassword('admin123');
    } else if (role === 'MORADOR') {
      setUsername('morador');
      setPassword('morador123');
    }
  };

  const handleLogin = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    
    // Resetar erro anterior
    setError(null);
    
    // Validar campos
    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha usuário e senha');
      return;
    }

    // Não validar para MORADOR (redireciona para cadastro)
    if (selectedRole === 'MORADOR') {
      onLogin(selectedRole);
      return;
    }
    
    setLoading(true);
    
    try {
      // Validar credenciais no Supabase
      const user = await loginUser(username.trim(), password);
      
      if (!user) {
        setError('Usuário ou senha inválidos');
        setLoading(false);
        return;
      }

      // Verificar se o role do usuário corresponde ao selecionado
      if (user.role !== selectedRole) {
        setError(`Este usuário é ${user.role === 'PORTEIRO' ? 'Porteiro' : 'Síndico'}. Selecione o papel correto.`);
        setLoading(false);
        return;
      }

      // Salvar sessão
      saveUserSession(user);
      
      // Delay para feedback visual
      setTimeout(() => {
        onLogin(selectedRole);
      }, 500);
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Erro ao conectar com o servidor. Tente novamente.');
      setLoading(false);
    }
  };

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
              {/* Texto Acesso Restrito */}
              <p className={`text-[10px] uppercase tracking-[0.3em] font-black ${
                theme === 'light' ? 'text-gray-500' : 'text-zinc-500'
              }`}>ACESSO RESTRITO</p>
            </header>

            <div className={`p-1 rounded-2xl mb-8 flex relative border transition-all ${
              theme === 'light' 
                ? 'bg-gray-100/80 border-gray-200/50' 
                : 'bg-white/5 border-white/5'
            }`}>
              {/* Indicador deslizante */}
              <div 
                className={`absolute top-1 bottom-1 rounded-xl transition-all duration-500 ease-out shadow-xl ${
                  theme === 'light' ? 'bg-white shadow-lg' : 'bg-white'
                }`}
                style={{
                  width: 'calc(33.333% - 4px)',
                  transform: selectedRole === 'MORADOR' 
                    ? 'translateX(0)' 
                    : selectedRole === 'PORTEIRO' 
                    ? 'translateX(calc(100% + 4px))' 
                    : 'translateX(calc(200% + 8px))'
                }}
              />
              <button 
                type="button"
                onClick={() => {
                  handleRoleChange('MORADOR');
                  // Redirecionar para cadastro de morador ao selecionar
                  window.location.href = window.location.pathname + '?resident=true';
                }}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors duration-200 ${
                  selectedRole === 'MORADOR' 
                    ? (theme === 'light' ? 'text-gray-900' : 'text-black')
                    : (theme === 'light' ? 'text-gray-600' : 'text-zinc-500')
                }`}
              >
                Morador
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('PORTEIRO')}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors duration-200 ${
                  selectedRole === 'PORTEIRO' 
                    ? (theme === 'light' ? 'text-gray-900' : 'text-black')
                    : (theme === 'light' ? 'text-gray-600' : 'text-zinc-500')
                }`}
              >
                Portaria
              </button>
              <button 
                type="button"
                onClick={() => handleRoleChange('SINDICO')}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors duration-200 ${
                  selectedRole === 'SINDICO' 
                    ? (theme === 'light' ? 'text-gray-900' : 'text-black')
                    : (theme === 'light' ? 'text-gray-600' : 'text-zinc-500')
                }`}
              >
                Síndico
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
                  <User className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                  }`} />
                  <input 
                    type="text" 
                    placeholder="Usuário" 
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null); // Limpar erro ao digitar
                    }}
                    autoComplete="username"
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

              <button 
                type="submit"
                disabled={loading}
                className={`group w-full py-5 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 ${
                  theme === 'light'
                    ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg'
                    : 'bg-white text-black hover:bg-zinc-200 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)]'
                }`}
              >
                {loading ? (
                  <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
                    theme === 'light' 
                      ? 'border-white/20 border-t-white' 
                      : 'border-black/20 border-t-black'
                  }`} />
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
