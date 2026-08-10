import React, { useState, useEffect } from 'react';
import { User, Lock, Home, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface InviteInfo {
  email: string;
  expiresAt: string;
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const AcceptResidentInvitePage: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token')?.trim() || '';
    setToken(t);
    if (!t) {
      setError('Link inválido: token não encontrado.');
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/resident-invite?token=${encodeURIComponent(t)}`)
      .then((res) => res.json().then((data) => ({ status: res.status, ok: res.ok, ...data })).catch(() => ({ status: res.status, ok: false, error: 'Resposta inválida', code: null })))
      .then((data) => {
        if (data.error) {
          let message = data.error || 'Link inválido ou expirado.';
          const isLocalhost = typeof window !== 'undefined' && window.location?.hostname === 'localhost';
          if (isLocalhost && !data.code && data.status === 404) {
            message = 'Serviço de convite indisponível. Em desenvolvimento, rode npm run dev:api (ou npm run dev:all).';
          } else if (data.status === 500 && data.code === 'CONFIG_MISSING' && isLocalhost) {
            message = 'API sem configuração. Defina SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL no .env.local.';
          } else if (data.status === 500 && data.code === 'DB_ERROR') {
            message = data.error;
          }
          setError(message);
          setInvite(null);
        } else {
          setInvite({ email: data.email, expiresAt: data.expiresAt });
          setError(null);
        }
      })
      .catch(() => {
        const isLocalhost = typeof window !== 'undefined' && window.location?.hostname === 'localhost';
        setError(isLocalhost
          ? 'Não foi possível validar o link. Rode npm run dev:api (ou npm run dev:all).'
          : 'Erro ao validar o link. Tente novamente.');
      })
      .finally(() => setLoading(false));
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (!pwd || pwd.length < 6) return 'Senha deve ter no mínimo 6 caracteres.';
    if (pwd.length > 32) return 'Senha deve ter no máximo 32 caracteres.';
    if (!/^[A-Za-z0-9]+$/.test(pwd)) return 'Use apenas letras e números (sem espaços ou símbolos).';
    if (!/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) return 'A senha deve conter letras e números.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = name.trim();
    const unitTrim = unit.trim();
    if (!nameTrim || nameTrim.length < 2) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!unitTrim) {
      setError('Informe sua unidade (ex: Bl 01 / Apto 101).');
      return;
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/accept-resident-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: nameTrim, unit: unitTrim, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Não foi possível criar a conta. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Validando link...</p>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
        <div className="max-w-md w-full backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 shadow-2xl bg-white/[0.03]">
          <div className="flex items-center gap-3 text-red-400 mb-6">
            <AlertCircle className="w-8 h-8 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <a href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowRight className="w-4 h-4" /> Ir para o login
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
        <div className="max-w-md w-full backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 shadow-2xl bg-white/[0.03]">
          <div className="flex items-center gap-3 text-emerald-400 mb-6">
            <CheckCircle className="w-8 h-8 shrink-0" />
            <p className="text-sm font-medium">Conta criada com sucesso. Faça login com seu e-mail e senha.</p>
          </div>
          <a href="/" className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-black font-bold text-sm uppercase hover:opacity-90 transition-opacity">
            Ir para o login <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      <div className="max-w-md w-full backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 md:p-12 shadow-2xl bg-white/[0.03]">
        <header className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-500">Qualivida Gestão</p>
          <h1 className="text-xl font-black uppercase mt-2">Concluir cadastro</h1>
          <p className="text-xs text-zinc-500 mt-1">Você foi convidado como <strong className="text-white">Morador</strong></p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">E-mail</label>
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm">
              {invite?.email}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">Nome completo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-transparent border-b border-white/10 text-white placeholder:text-zinc-600 outline-none focus:border-white text-sm"
                placeholder="Seu nome"
                required
                minLength={2}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">Unidade</label>
            <div className="relative">
              <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-transparent border-b border-white/10 text-white placeholder:text-zinc-600 outline-none focus:border-white text-sm"
                placeholder="Ex: Bl 01 / Apto 101"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">Senha de acesso</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-transparent border-b border-white/10 text-white placeholder:text-zinc-600 outline-none focus:border-white text-sm"
                placeholder="Mín. 6 caracteres, letras e números"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">Confirmar senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-transparent border-b border-white/10 text-white placeholder:text-zinc-600 outline-none focus:border-white text-sm"
                placeholder="Repita a senha"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-white text-black font-bold text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {submitting ? 'Criando conta...' : 'Criar conta e acessar'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-500 mt-6">
          <a href="/" className="underline hover:text-white transition-colors">Voltar ao login</a>
        </p>
      </div>
    </div>
  );
};

export default AcceptResidentInvitePage;
