import React, { useState, useEffect } from 'react';
import { ArrowLeft, Lock, CheckCircle, XCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getOrRestoreRecoverySession, clearRecoveryHashFromUrl } from '../services/userAuth';

interface ResetPasswordPageProps {
  theme?: 'dark' | 'light';
  onBackToLogin?: () => void;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  theme = 'dark',
  onBackToLogin
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidRecoveryLink, setIsValidRecoveryLink] = useState<boolean | null>(null);
  const [recoverySession, setRecoverySession] = useState<any>(null);

  // Verificar link de recuperação ao carregar a página
  useEffect(() => {
    const checkRecoveryLink = async () => {
      try {
        const result = await getOrRestoreRecoverySession();
        if (result.session) {
          setRecoverySession(result.session);
          setIsValidRecoveryLink(true);
        } else {
          setIsValidRecoveryLink(false);
          setMessage({
            type: 'error',
            text: 'Link de recuperação inválido, expirado ou já utilizado. Solicite um novo link de recuperação.'
          });
        }
      } catch (error) {
        console.error('Erro ao verificar link de recuperação:', error);
        setIsValidRecoveryLink(false);
        setMessage({
          type: 'error',
          text: 'Erro ao processar o link de recuperação. Tente solicitar um novo link.'
        });
      }
    };

    checkRecoveryLink();
  }, []);

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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setMessage({ type: 'error', text: 'Preencha todos os campos.' });
      return;
    }

    // Validação de força da senha
    const strength = validatePasswordStrength(newPassword.trim());
    if (!strength.ok) {
      setMessage({ type: 'error', text: strength.error || 'A senha não atende aos requisitos mínimos.' });
      return;
    }

    // Verificação se as senhas coincidem
    if (newPassword.trim() !== confirmPassword.trim()) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    // Verificar se temos uma sessão de recuperação válida
    if (!recoverySession) {
      setMessage({ type: 'error', text: 'Sessão de recuperação expirada. Solicite um novo link.' });
      return;
    }

    const pwdTrim = newPassword.trim();

    setLoading(true);
    setMessage(null);

    try {
      // Atualizar a senha usando Supabase Auth
      const { error } = await supabase.auth.updateUser({ password: pwdTrim });

      if (error) {
        console.error('Erro ao atualizar senha:', error);
        const errMsg = error.message || '';
        const isSessionError = /session|expired|invalid|auth/i.test(errMsg);
        const isPasswordError = /password|validation|policy|minimum|length/i.test(errMsg);

        const errorText = isSessionError
          ? 'O link expirou ou já foi usado. Solicite um novo link de recuperação.'
          : isPasswordError
            ? 'A senha não atende aos requisitos do servidor. Use apenas letras e números (6-32 caracteres).'
            : errMsg || 'Erro ao redefinir senha. Tente novamente.';

        setMessage({ type: 'error', text: errorText });
      } else {
        // Sucesso! Limpar hash da URL e redirecionar
        clearRecoveryHashFromUrl();
        setMessage({
          type: 'success',
          text: 'Senha redefinida com sucesso! Você será redirecionado para o login.'
        });

        // Fazer logout para limpar a sessão de recuperação
        await supabase.auth.signOut();

        // Redirecionar após 3 segundos
        setTimeout(() => {
          if (onBackToLogin) {
            onBackToLogin();
          } else {
            // Fallback: redirecionar para a página principal
            window.location.href = '/';
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Erro inesperado:', error);
      setMessage({
        type: 'error',
        text: 'Erro inesperado ao redefinir senha. Tente novamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Se ainda está verificando o link
  if (isValidRecoveryLink === null) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  // Se o link não é válido
  if (isValidRecoveryLink === false) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
      }`}>
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Link Inválido</h1>
          </div>

          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.type === 'error'
                ? 'bg-red-100 border border-red-400 text-red-700'
                : 'bg-green-100 border border-green-400 text-green-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Voltar ao Login
            </button>

            <button
              onClick={() => window.location.href = '/?forgot=true'}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Solicitar Novo Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Página de reset de senha válida
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
    }`}>
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Redefinir Senha</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Digite sua nova senha abaixo
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.type === 'error'
              ? 'bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300'
              : 'bg-green-100 border border-green-400 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300'
          }`}>
            <div className="flex items-center">
              {message.type === 'error' ? (
                <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              )}
              {message.text}
            </div>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nova Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Digite sua nova senha"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              6-32 caracteres, letras e números apenas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Confirme sua nova senha"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Redefinindo...
              </>
            ) : (
              'Redefinir Senha'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="text-blue-500 hover:text-blue-600 text-sm"
          >
            ← Voltar ao Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;