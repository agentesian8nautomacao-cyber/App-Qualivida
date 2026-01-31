import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Lock, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../services/supabase';
import { requestPasswordReset, getEmailForReset, resetPasswordWithToken, getOrRestoreRecoverySession, clearRecoveryHashFromUrl } from '../services/userAuth';
import { getEmailForResetResident, computeResidentPasswordHash } from '../services/residentAuth';

interface ForgotPasswordProps {
  onBack: () => void;
  theme?: 'dark' | 'light';
  initialToken?: string;
  initialStep?: 'request' | 'reset';
  /** true quando o usuário veio da aba Morador */
  isResident?: boolean;
  /** Mensagem quando o link de recuperação expirou ou já foi usado (vindo do hash da URL) */
  recoveryLinkExpiredMessage?: string;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, theme = 'dark', initialToken, initialStep, isResident = false, recoveryLinkExpiredMessage }) => {
  const [step, setStep] = useState<'request' | 'reset'>(initialStep || 'request');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [token, setToken] = useState(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    recoveryLinkExpiredMessage ? { type: 'error', text: recoveryLinkExpiredMessage } : null
  );
  const [recoveryFromAuth, setRecoveryFromAuth] = useState(false);

  useEffect(() => {
    if (initialStep === 'reset' && initialToken) {
      setStep('reset');
      setToken(initialToken);
    }
  }, [initialStep, initialToken]);

  // Detectar link de recuperação no hash e estabelecer sessão assim que a página carregar.
  // NÃO limpar o hash aqui — manter até após reset bem-sucedido para poder restaurar sessão no submit.
  useEffect(() => {
    const isRecoveryHash = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
    if (!isRecoveryHash) return;
    setStep('reset');
    setRecoveryFromAuth(true);
    getOrRestoreRecoverySession().then(() => {
      // Sessão estabelecida ou será restaurada no submit a partir do hash ainda presente
    });
  }, []);

  useEffect(() => {
    if (step !== 'reset') return;
    if (recoveryFromAuth) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const isRecovery = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
      if (session?.user && isRecovery) {
        setRecoveryFromAuth(true);
      }
    });
  }, [step, recoveryFromAuth]);

  const validatePasswordStrength = (password: string): { ok: boolean; error?: string } => {
    if (!password || password.length < 6) {
      return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
    }
    if (password.length > 32) {
      return { ok: false, error: 'A senha deve ter no máximo 32 caracteres.' };
    }
    if (!/^[A-Za-z0-9]+$/.test(password)) {
      return { ok: false, error: 'Use apenas letras e números (sem espaços ou símbolos).' };
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return { ok: false, error: 'A senha deve conter letras e números.' };
    }
    return { ok: true };
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = usernameOrEmail.trim();
    if (!value) {
      setMessage({ type: 'error', text: isResident ? 'Por favor, informe a unidade ou e-mail cadastrado.' : 'Por favor, informe o e-mail ou usuário cadastrado.' });
      return;
    }

    // Aceita e-mail ou nome de usuário; se for e-mail, valida formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value.includes('@') && !emailRegex.test(value.toLowerCase())) {
      setMessage({ type: 'error', text: 'Informe um e-mail válido.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const successMessage = 'Se o e-mail estiver cadastrado, você receberá um link de recuperação por e-mail. Verifique a caixa de entrada e o spam. No Gmail, confira também a pasta Spam e a aba Promoções.';

    const emailToUse = value.includes('@')
      ? value.trim().toLowerCase()
      : (isResident ? await getEmailForResetResident(value) : await getEmailForReset(value)) || '';

    if (!emailToUse) {
      setLoading(false);
      setMessage({ type: 'error', text: isResident ? 'Unidade ou e-mail não encontrado. Verifique e tente novamente.' : 'E-mail ou usuário não encontrado. Verifique e tente novamente.' });
      return;
    }

    // Único fluxo: Supabase Auth envia o link de recuperação por e-mail
    const authResult = await requestPasswordReset(emailToUse);
    setLoading(false);
    if (authResult.success) {
      setMessage({ type: 'success', text: successMessage });
    } else {
      const err = authResult.error || '';
      const isRateLimit = /rate limit|rate_limit|too many requests|limite/i.test(err);
      const isRecoverySendError = /error sending recovery|500|internal server error/i.test(err);
      let text: string;
      if (isRateLimit) {
        text = 'Limite de e-mails por hora atingido. Aguarde alguns minutos e tente novamente. O administrador pode aumentar o limite em Supabase (Authentication → Rate Limits).';
      } else if (isRecoverySendError) {
        text = 'Falha ao enviar o e-mail de recuperação. O administrador deve verificar no Supabase: URL Configuration (adicionar o app em Redirect URLs) e, se usar SMTP personalizado, as credenciais em E-mails → Configurações SMTP.';
      } else {
        text = err || 'Erro ao solicitar recuperação. Tente novamente mais tarde.';
      }
      setMessage({ type: 'error', text });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const strength = validatePasswordStrength(newPassword.trim());
    if (!strength.ok) {
      setMessage({ type: 'error', text: strength.error || 'A senha não atende aos requisitos mínimos.' });
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    const pwdTrim = newPassword.trim();

    setLoading(true);
    setMessage(null);

    if (recoveryFromAuth) {
      // Nunca assumir sessão ativa: obter ou restaurar a partir do link (hash ainda na URL)
      const { session } = await getOrRestoreRecoverySession();
      if (!session) {
        setLoading(false);
        setMessage({ type: 'error', text: 'O link expirou ou já foi usado. Solicite um novo link de recuperação abaixo (use o mesmo e-mail).' });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwdTrim });
      let syncResidentOk = false;
      if (!error) {
        clearRecoveryHashFromUrl(); // Só limpar após sucesso — evita "Auth session missing!" em retries
        try {
          // Usar o mesmo hash do login morador (frontend) para garantir que a senha funcione na aba Morador
          const residentHash = await computeResidentPasswordHash(pwdTrim);
          const { error: rpcError } = await supabase.rpc('sync_resident_password_after_reset', { new_hash: residentHash });
          syncResidentOk = !rpcError;
        } catch (_) {}
      }
      setLoading(false);
      if (!error) {
        const successText = syncResidentOk
          ? 'Senha redefinida com sucesso! Você já pode fazer login (aba Morador: unidade + senha; aba Admin/Porteiro: e-mail ou usuário + senha).'
          : 'Senha redefinida com sucesso! Para login como morador (unidade + senha): o administrador deve executar no Supabase o script supabase_sync_resident_password_after_reset.sql e o e-mail do morador deve ser o mesmo que recebeu este link. Depois, faça login na aba Morador. Veja RECUPERACAO_SENHA_LOGIN_MORADOR.md.';
        setMessage({ type: 'success', text: successText });
        await supabase.auth.signOut();
        setTimeout(() => onBack(), 2000);
      } else {
        const errMsg = (error as { message?: string; status?: number })?.message || '';
        const status = (error as { status?: number })?.status;
        const isSessionMissing = /session missing|auth session|invalid session|session expired|no session/i.test(errMsg);
        // 422 = servidor recusou a senha (política do Supabase). Não repetir a instrução; explicar que o servidor recusou.
        const isServerRejected = status === 422 || /validation|invalid|password|policy|minimum|length/i.test(errMsg);
        const errorText = isSessionMissing
          ? 'O link expirou ou já foi usado. Solicite um novo link de recuperação abaixo (use o mesmo e-mail).'
          : isServerRejected
            ? 'O servidor não aceitou esta senha. Use apenas letras e números (6 a 32 caracteres). Se o erro continuar, tente 8 ou mais caracteres ou peça ao administrador para ajustar em Supabase: Auth → Providers → Email → Password (mín. 6, sem exigência de caractere especial).'
            : errMsg || 'Erro ao redefinir senha. Tente novamente ou solicite um novo link.';
        setMessage({ type: 'error', text: errorText });
      }
      return;
    }

    const effectiveToken = (initialToken || token).trim();
    if (!effectiveToken) {
      setLoading(false);
      setMessage({ type: 'error', text: 'Token de recuperação inválido ou ausente.' });
      return;
    }

    const result = await resetPasswordWithToken(effectiveToken, pwdTrim);
    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Senha redefinida com sucesso!' });
      setTimeout(() => onBack(), 2000);
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
              ? (isResident ? 'Informe a unidade ou e-mail cadastrado para receber o link de recuperação por e-mail.' : 'Informe o e-mail ou usuário cadastrado para receber o link de recuperação por e-mail. Se o e-mail existir, você receberá o link em alguns instantes.')
              : 'Use apenas letras e números (6 a 32 caracteres). Maiúsculas e minúsculas são diferenciadas.'}
          </p>

          {recoveryLinkExpiredMessage && step === 'request' && (
            <p className={`text-sm mb-4 ${
              theme === 'light' ? 'text-amber-700' : 'text-amber-400'
            }`}>
              O link de recuperação expira em cerca de 1 hora. Use o formulário abaixo para solicitar um novo.
            </p>
          )}

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
                  placeholder={isResident ? 'Unidade ou e-mail cadastrado' : 'E-mail ou usuário cadastrado'} 
                  value={usernameOrEmail}
                  autoComplete="username email"
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
              {/* Token só para fluxo legado; recovery do Supabase Auth não usa token */}
              {!recoveryFromAuth && !initialToken && (
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
              )}

              <div className="relative">
                <Lock className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'light' ? 'text-gray-400' : 'text-zinc-600'
                }`} />
                <input 
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Nova senha (6 a 32 caracteres, só letras e números)" 
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
