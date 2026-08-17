import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { BRANDING } from '../../config/branding';
import { supabase, isSupabasePlaceholder } from '../../services/supabase';
import { getMasterSession } from '../../services/masterApi';

type Props = {
  onSuccess: () => void;
};

export default function MasterLogin({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    if (isSupabasePlaceholder) {
      setError('Supabase não configurado neste ambiente.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (authError || !data.session?.access_token) {
        setError('E-mail ou senha inválidos.');
        setLoading(false);
        return;
      }
      const session = await getMasterSession(data.session.access_token);
      if (!session.ok) {
        await supabase.auth.signOut();
        if (session.error.status === 403) {
          setError('Acesso Master negado. Esta conta não é Platform Admin ativo.');
        } else if (session.error.status === 401) {
          setError('Sessão inválida. Tente novamente.');
        } else {
          setError(session.error.error);
        }
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError('Não foi possível conectar ao servidor Master.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06101f] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1930] p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <img src={BRANDING.icon} alt="" className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Platform Admin
            </p>
            <h1 className="text-xl font-black">{BRANDING.name} Master</h1>
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          Área exclusiva de administradores da plataforma. O acesso operacional do condomínio não
          autoriza esta tela.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Senha</span>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2.5 pr-10 text-sm outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          {error && (
            <p className="text-sm text-red-300 flex items-start gap-2" role="alert">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-500 text-slate-950 font-black py-2.5 hover:bg-cyan-400 disabled:opacity-60"
          >
            {loading ? 'Validando…' : 'Entrar no Master'}
          </button>
        </form>
        <p className="mt-6 text-xs text-slate-500 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          A autorização é validada no servidor. A UI não concede privilégio.
        </p>
      </div>
    </div>
  );
}
