import React, { useState } from 'react';
import { User, Lock, Building, Mail, Phone, ArrowRight, Eye, EyeOff, CheckCircle2, AlertCircle, Sun, Moon, ChevronLeft } from 'lucide-react';
import { Resident } from '../types';
import { registerResident, loginResident } from '../services/residentAuth';
import { validateUnit, normalizeUnit, formatUnit, compareUnits } from '../utils/unitFormatter';

interface ResidentRegisterProps {
  onRegister: (resident: Resident, password: string) => void;
  onLogin: (unit: string, password: string) => void;
  onBack?: () => void; // Callback para voltar ao login
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
  existingResidents?: Resident[]; // Lista de moradores já cadastrados
}

const ResidentRegister: React.FC<ResidentRegisterProps> = ({
  onRegister,
  onLogin,
  onBack,
  theme = 'dark',
  toggleTheme,
  existingResidents = []
}) => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Usa a função de validação do utilitário

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validações
    if (!formData.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (!formData.unit.trim()) {
      setError('Unidade é obrigatória');
      return;
    }

    if (!validateUnit(formData.unit)) {
      setError('Unidade inválida. Use formato: bloco/apartamento (ex: 03/005, 3/5)');
      return;
    }

    // Normalizar unidade para comparação
    const normalizedUnit = normalizeUnit(formData.unit);

    // Verificar se já existe morador com essa unidade (verificação local)
    const existingResident = existingResidents.find(
      r => compareUnits(r.unit, normalizedUnit)
    );

    // A verificação definitiva será feita no Supabase, mas avisar aqui também
    if (existingResident) {
      setError(`Já existe um cadastro para a unidade ${formatUnit(normalizedUnit)}. Use o modo de login.`);
      setMode('login');
      return;
    }

    if (!formData.password || formData.password.length < 3) {
      setError('Senha deve ter no mínimo 3 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    // A senha padrão é a unidade, mas pode ser alterada
    const passwordToUse = formData.password || formData.unit.toUpperCase();

    setLoading(true);

    try {
      // Criar objeto resident (sem id, será gerado no Supabase)
      // Normalizar unidade antes de salvar
      const newResident = {
        name: formData.name.trim(),
        unit: normalizedUnit,
        email: formData.email.trim() || '',
        phone: formData.phone.trim() || '',
        whatsapp: formData.phone.trim() || ''
      };

      // Registrar no Supabase
      const result = await registerResident(newResident, passwordToUse);
      
      if (!result.success) {
        // Tratar erro de forma mais detalhada
        let errorMessage = 'Erro ao realizar cadastro';
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMessage = result.error;
          } else if (typeof result.error === 'object' && result.error !== null) {
            // Se for um objeto de erro do Supabase
            const errObj = result.error as { message?: string };
            errorMessage = errObj.message || JSON.stringify(result.error);
          }
        }
        setError(errorMessage);
        return;
      }

      // Chamar callback com o resident retornado
      await onRegister(result.resident, passwordToUse);
      
      setSuccess('Cadastro realizado com sucesso! Redirecionando...');
      setTimeout(() => {
        setMode('login');
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }, 2000);
    } catch (err: unknown) {
      // Tratar erro de forma mais detalhada
      let errorMessage = 'Erro ao realizar cadastro';
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (typeof err === 'object' && err !== null) {
          // Verificar se é um Error
          if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
            errorMessage = (err as { message: string }).message;
          } else {
            // Se for um objeto de erro do Supabase
            const errObj = err as { message?: string; error?: { message?: string } };
            errorMessage = errObj.message || errObj.error?.message || JSON.stringify(err);
          }
        }
      }
      console.error('Erro ao cadastrar morador:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.unit.trim()) {
      setError('Unidade é obrigatória');
      return;
    }

    if (!formData.password) {
      setError('Senha é obrigatória');
      return;
    }

    setLoading(true);

    try {
      // Normalizar unidade antes de fazer login
      const normalizedUnit = normalizeUnit(formData.unit);
      // Fazer login no Supabase
      const result = await loginResident(normalizedUnit, formData.password);
      
      if (!result.success || !result.resident) {
        setError(result.error || 'Unidade ou senha incorretos');
        return;
      }

      // Chamar callback com sucesso
      await onLogin(normalizedUnit, formData.password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleUnitChange = (value: string) => {
    // Converter para maiúsculo e remover espaços
    const upperValue = value.toUpperCase().replace(/\s/g, '');
    setFormData(prev => ({ ...prev, unit: upperValue }));
    
    // Se estiver no modo registro e senha estiver vazia, preencher com a unidade
    if (mode === 'register' && !formData.password) {
      setFormData(prev => ({ ...prev, password: upperValue, confirmPassword: upperValue }));
    }
  };

  return (
    <div className={`relative min-h-screen w-full flex items-center justify-center overflow-hidden transition-colors duration-500 ${
      theme === 'light' ? 'bg-gray-50' : 'bg-[#050505]'
    }`}>
      <div className="relative z-10 w-full max-w-md p-4 opacity-100">
        <div className={`backdrop-blur-3xl border rounded-[48px] p-8 md:p-12 shadow-2xl relative overflow-hidden group transition-all duration-500 ${
          theme === 'light' 
            ? 'bg-white border-gray-200/50' 
            : 'bg-white/[0.03] border-white/10'
        }`}>
          
          {/* Botão de voltar */}
          {onBack && (
            <button
              onClick={onBack}
              className={`absolute top-6 left-6 p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center z-20 ${
                theme === 'light'
                  ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
              title="Voltar para login"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          
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
              {/* Logo */}
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
                  />
                </div>
              </div>
              <p className={`text-[10px] uppercase tracking-[0.3em] font-black ${
                theme === 'light' ? 'text-gray-500' : 'text-zinc-500'
              }`}>ACESSO MORADORES</p>
            </header>

            {/* Toggle Register/Login */}
            <div className={`p-1 rounded-2xl mb-8 flex relative border transition-all ${
              theme === 'light' 
                ? 'bg-gray-100/80 border-gray-200/50' 
                : 'bg-white/5 border-white/5'
            }`}>
              <div 
                className={`absolute top-1 bottom-1 rounded-xl transition-all duration-500 ease-out shadow-xl ${
                  theme === 'light' ? 'bg-white shadow-lg' : 'bg-white'
                }`}
                style={{
                  width: 'calc(50% - 2px)',
                  transform: mode === 'register' ? 'translateX(0)' : 'translateX(calc(100% + 2px))'
                }}
              />
              <button 
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccess(null);
                }}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors duration-200 ${
                  mode === 'register' 
                    ? (theme === 'light' ? 'text-gray-900' : 'text-black')
                    : (theme === 'light' ? 'text-gray-600' : 'text-zinc-500')
                }`}
              >
                Cadastro
              </button>
              <button 
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase transition-colors duration-200 ${
                  mode === 'login' 
                    ? (theme === 'light' ? 'text-gray-900' : 'text-black')
                    : (theme === 'light' ? 'text-gray-600' : 'text-zinc-500')
                }`}
              >
                Entrar
              </button>
            </div>

            {/* Mensagens de erro/sucesso */}
            {error && (
              <div className={`mb-6 p-4 rounded-xl border flex items-center gap-2 ${
                theme === 'light'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}

            {success && (
              <div className={`mb-6 p-4 rounded-xl border flex items-center gap-2 ${
                theme === 'light'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
              }`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs font-bold">{success}</p>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={mode === 'register' ? handleRegister : handleLogin} className="space-y-6">
              {mode === 'register' && (
                <div className="space-y-4">
                  <div className="relative">
                    <User className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                    <input 
                      type="text" 
                      placeholder="Nome completo" 
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                        theme === 'light'
                          ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                          : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                      }`}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Building className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                    <input 
                      type="text" 
                      placeholder="Unidade (ex: 03/005, 3/5)" 
                      value={formData.unit}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium uppercase ${
                        theme === 'light'
                          ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                          : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                      }`}
                      required
                    />
                  </div>

                  <div className="relative">
                    <Mail className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                    <input 
                      type="email" 
                      placeholder="E-mail (opcional)" 
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                        theme === 'light'
                          ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                          : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                      }`}
                    />
                  </div>

                  <div className="relative">
                    <Phone className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                    <input 
                      type="tel" 
                      placeholder="Telefone/WhatsApp (opcional)" 
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                        theme === 'light'
                          ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                          : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                      }`}
                    />
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Building className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                    }`} />
                    <input 
                      type="text" 
                      placeholder="Unidade (ex: 03/005, 3/5)" 
                      value={formData.unit}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium uppercase ${
                        theme === 'light'
                          ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                          : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                      }`}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="relative">
                <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                }`} />
                <input 
                  type={mode === 'register' && showPassword ? 'text' : mode === 'login' && showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Senha (padrão: sua unidade)' : 'Senha'} 
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
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

              {mode === 'register' && (
                <div className="relative">
                  <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                  }`} />
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirmar senha" 
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className={`w-full pl-8 pr-12 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                      theme === 'light'
                        ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                        : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                    }`}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-0 top-1/2 -translate-y-1/2 transition-colors ${
                      theme === 'light' ? 'text-gray-400 hover:text-gray-600' : 'text-zinc-600 hover:text-white'
                    }`}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {mode === 'register' && (
                <p className={`text-xs ${
                  theme === 'light' ? 'text-gray-500' : 'text-zinc-500'
                }`}>
                  💡 <strong>Dica:</strong> Sua senha padrão é sua unidade (ex: 201A). Você pode alterá-la.
                </p>
              )}

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
                    {mode === 'register' ? 'Criar Conta' : 'Entrar'}
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

export default ResidentRegister;