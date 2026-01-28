import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Lock, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { generatePasswordResetToken, resetPasswordWithToken } from '../services/userAuth';

interface ForgotPasswordProps {
  onBack: () => void;
  theme?: 'dark' | 'light';
  initialToken?: string;
  initialStep?: 'request' | 'reset';
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, theme = 'dark', initialToken, initialStep }) => {
  const [step, setStep] = useState<'request' | 'reset'>(initialStep || 'request');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [token, setToken] = useState(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialStep === 'reset' && initialToken) {
      setStep('reset');
      setToken(initialToken);
    }
  }, [initialStep, initialToken]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setMessage({ type: 'error', text: 'Por favor, informe seu usuário ou email.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
      const res = await fetch(`${base}/api/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: usernameOrEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };

      if (res.ok && data.success) {
        setLoading(false);
        setMessage({
          type: 'success',
          text: data.message || 'Se o usuário existir e tiver email cadastrado, você receberá um link por email. Verifique a caixa de entrada e o spam.',
        });
        return;
      }
    } catch {
      /* fallback abaixo */
    }

    const result = await generatePasswordResetToken(usernameOrEmail.trim());
    setLoading(false);

    if (result.success) {
      setMessage({
        type: 'success',
        text: 'API de email não configurada. Em desenvolvimento: verifique o console do navegador para o token e use o passo "Redefinir senha".',
      });
      setTimeout(() => setStep('reset'), 1500);
    } else {
      setMessage({ type: 'error', text: result.message || 'Erro ao solicitar recuperação.' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setMessage({ type: 'error', text: 'Por favor, informe o token de recuperação.' });
      return;
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const result = await resetPasswordWithToken(token.trim(), newPassword);

    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Senha redefinida com sucesso!' });
      setTimeout(() => {
        onBack();
      }, 2000);
    } else {
      setMessage({ type: 'error', text: result.message || 'Erro ao redefinir senha.' });
    }
  };

  return (
    <div className="relative z-10 w-full max-w-md p-4">
      <div className={`backdrop-blur-3xl border rounded-[48px] p-8 md:p-12 shadow-2xl relative overflow-hidden transition-all duration-500 ${
        theme === 'light' 
          ? 'bg-white border-gray-200/50' 
          : 'bg-white/[0.03] border-white/10'
      }`}>
        {/* Botão voltar */}
        <button
          onClick={onBack}
          className={`absolute top-6 left-6 p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${
            theme === 'light'
              ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="mt-12">
          <h2 className={`text-2xl font-black tracking-tighter mb-2 ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}>
            {step === 'request' ? 'Recuperar Senha' : 'Redefinir Senha'}
          </h2>
          <p className={`text-sm mb-8 ${
            theme === 'light' ? 'text-gray-600' : 'text-zinc-400'
          }`}>
            {step === 'request' 
              ? 'Digite seu usuário ou email para receber instruções de recuperação.'
              : 'Digite o token recebido e sua nova senha.'}
          </p>

          {/* Mensagens */}
          {message && (
            <div className={`p-4 rounded-xl border backdrop-blur-sm mb-6 flex items-start gap-3 ${
              message.type === 'success'
                ? theme === 'light'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-green-500/10 border-green-500/30 text-green-400'
                : theme === 'light'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium flex-1">{message.text}</p>
            </div>
          )}

          {/* Formulário de solicitação */}
          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div className="relative">
                <Mail className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                }`} />
                <input 
                  type="text" 
                  placeholder="Usuário ou Email" 
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    setMessage(null);
                  }}
                  className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                    theme === 'light'
                      ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                      : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                  }`}
                  required
                  disabled={loading}
                />
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
                    Enviar Solicitação
                    <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Formulário de redefinição */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="relative">
                <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                }`} />
                <input 
                  type="text" 
                  placeholder="Token de Recuperação" 
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setMessage(null);
                  }}
                  className={`w-full pl-8 pr-4 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                    theme === 'light'
                      ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                      : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                  }`}
                  required
                  disabled={loading}
                />
              </div>

              <div className="relative">
                <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                }`} />
                <input 
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Nova Senha (mínimo 6 caracteres)" 
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setMessage(null);
                  }}
                  className={`w-full pl-8 pr-10 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                    theme === 'light'
                      ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                      : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                  }`}
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity ${
                    theme === 'light' ? 'text-gray-600' : 'text-zinc-400'
                  }`}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                }`} />
                <input 
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirmar Nova Senha" 
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setMessage(null);
                  }}
                  className={`w-full pl-8 pr-10 py-3 bg-transparent border-b text-sm outline-none transition-all font-medium ${
                    theme === 'light'
                      ? 'border-gray-300/50 text-gray-900 placeholder:text-gray-400 focus:border-gray-600'
                      : 'border-white/10 text-white placeholder:text-zinc-700 focus:border-white'
                  }`}
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity ${
                    theme === 'light' ? 'text-gray-600' : 'text-zinc-400'
                  }`}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                    Redefinir Senha
                    <Lock className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Link voltar */}
          <button
            onClick={onBack}
            className={`w-full mt-6 text-sm text-center underline transition-colors ${
              theme === 'light' ? 'text-gray-600 hover:text-gray-900' : 'text-zinc-500 hover:text-white'
            }`}
          >
            Voltar para login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
