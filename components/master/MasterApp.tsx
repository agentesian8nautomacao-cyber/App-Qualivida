import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { getMasterSession } from '../../services/masterApi';
import MasterDenied from './MasterDenied';
import MasterDashboard from './MasterDashboard';
import MasterLayout, { type MasterPage } from './MasterLayout';
import MasterLogin from './MasterLogin';
import MasterOrganizationDetail from './MasterOrganizationDetail';
import MasterOrganizations from './MasterOrganizations';

function normalizePath(raw: string): string {
  const path = raw.replace(/\/$/, '') || '/';
  return path;
}

function pageFromPath(path: string): MasterPage {
  if (path === '/master/organizations') return 'organizations';
  if (/^\/master\/organizations\/[0-9a-f-]{36}$/i.test(path)) return 'organization-detail';
  return 'dashboard';
}

function orgIdFromPath(path: string): string | null {
  const m = path.match(/^\/master\/organizations\/([0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

export default function MasterApp() {
  const [path, setPath] = useState(() =>
    typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/master'
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);

  const navigate = useCallback((next: string) => {
    const normalized = normalizePath(next);
    window.history.pushState({}, '', normalized);
    setPath(normalized);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const validateServer = useCallback(async (token: string) => {
    try {
      const res = await getMasterSession(token);
      if (!res.ok) {
        setAccessToken(null);
        if (res.error.status === 403) {
          setDenied(
            res.error.reason === 'SUSPENDED'
              ? 'Este Platform Admin está suspenso e não pode acessar /master.'
              : 'Esta conta não é Platform Admin. O painel operacional não autoriza o Master.'
          );
        } else if (res.error.status === 503) {
          setDenied(res.error.error);
        } else {
          setDenied(null);
          navigate('/master/login');
        }
        return false;
      }
      setDenied(null);
      setAccessToken(token);
      return true;
    } catch {
      setAccessToken(null);
      setDenied('API Master indisponível.');
      return false;
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const token = data.session?.access_token || null;
      setEmail(data.session?.user.email || null);
      if (normalizePath(window.location.pathname) === '/master/login') {
        setChecking(false);
        if (token) {
          const ok = await validateServer(token);
          if (ok) navigate('/master');
        }
        return;
      }
      if (!token) {
        setChecking(false);
        navigate('/master/login');
        return;
      }
      await validateServer(token);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, validateServer]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAccessToken(null);
    setEmail(null);
    setDenied(null);
    navigate('/master/login');
  }, [navigate]);

  const onUnauthorized = useCallback(() => {
    setAccessToken(null);
    navigate('/master/login');
  }, [navigate]);

  const onForbidden = useCallback((message: string) => {
    setDenied(message);
    setAccessToken(null);
  }, []);

  const page = useMemo(() => pageFromPath(path), [path]);
  const orgId = useMemo(() => orgIdFromPath(path), [path]);

  if (path === '/master/login') {
    return (
      <MasterLogin
        onSuccess={() => {
          void (async () => {
            const { data } = await supabase.auth.getSession();
            setEmail(data.session?.user.email || null);
            setAccessToken(data.session?.access_token || null);
            setDenied(null);
            navigate('/master');
          })();
        }}
      />
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#06101f] text-slate-400 flex items-center justify-center">
        Validando autorização Master…
      </div>
    );
  }

  if (denied) {
    return (
      <MasterDenied
        message={denied}
        onBackToLogin={() => {
          setDenied(null);
          void logout();
        }}
      />
    );
  }

  if (!accessToken) {
    return (
      <MasterDenied
        title="Sessão expirada"
        message="Faça login novamente. Uma sessão operacional antiga não autoriza o Master."
        onBackToLogin={() => navigate('/master/login')}
      />
    );
  }

  return (
    <MasterLayout page={page} email={email} onNavigate={navigate} onLogout={() => void logout()}>
      {page === 'dashboard' && (
        <MasterDashboard
          accessToken={accessToken}
          onUnauthorized={onUnauthorized}
          onForbidden={onForbidden}
        />
      )}
      {page === 'organizations' && (
        <MasterOrganizations
          accessToken={accessToken}
          onOpen={(id) => navigate(`/master/organizations/${id}`)}
          onUnauthorized={onUnauthorized}
          onForbidden={onForbidden}
        />
      )}
      {page === 'organization-detail' && orgId && (
        <MasterOrganizationDetail
          id={orgId}
          accessToken={accessToken}
          onUnauthorized={onUnauthorized}
          onForbidden={onForbidden}
        />
      )}
    </MasterLayout>
  );
}
