import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Login Master no mesmo modal', () => {
  it('Login não navega para /master/login', () => {
    const src = readFileSync(join(root, 'components/Login.tsx'), 'utf8');
    expect(src).not.toMatch(/\/master\/login/);
    expect(src).toMatch(/handleRoleChange\('MASTER'\)/);
    expect(src).toMatch(/loginMasterWithPassword/);
    expect(src).toMatch(/id="operational-username"/);
    expect(src).toMatch(/id="operational-password"/);
    expect(src).toMatch(/sentinela-login-card/);
    expect(src).toMatch(/Acesso Master/);
  });

  it('seletor unifica Síndico e Administradora em ADM', () => {
    const src = readFileSync(join(root, 'components/Login.tsx'), 'utf8');
    expect(src).toMatch(/handleRoleChange\('PORTEIRO'\)/);
    expect(src).toMatch(/handleRoleChange\('ADM'\)/);
    expect(src).toMatch(/handleRoleChange\('MASTER'\)/);
    expect(src).not.toMatch(/handleRoleChange\('SINDICO'\)/);
    expect(src).not.toMatch(/handleRoleChange\('ADMINISTRADORA'\)/);
    expect(src).toMatch(/grid-cols-3/);
    expect(src).not.toMatch(/grid-cols-4/);
    expect(src).toMatch(/Acesso ADM/);
    expect(src).toMatch(/Administração Operacional/);
    expect(src).toMatch(/Acesso Portaria/);
    expect(src).toMatch(/Central de Operações/);
    expect(src).not.toMatch(/loginUser\([^)]*'ADM'/);
    const roles = readFileSync(join(root, 'types.ts'), 'utf8');
    expect(roles).toMatch(/'SINDICO'/);
    expect(roles).toMatch(/'ADMINISTRADORA'/);
    expect(roles).not.toMatch(/'ADM'/);
  });

  it('MasterApp não renderiza tela dedicada de login', () => {
    const src = readFileSync(join(root, 'components/master/MasterApp.tsx'), 'utf8');
    expect(src).not.toMatch(/MasterLogin/);
    expect(src).toMatch(/window\.location\.assign\('\/'\)/);
  });

  it('MasterLogin.tsx foi removido do fluxo visual', () => {
    expect(existsSync(join(root, 'components/master/MasterLogin.tsx'))).toBe(false);
  });

  it('masterAuth não contém senha nem service_role', () => {
    const src = readFileSync(join(root, 'services/masterAuth.ts'), 'utf8');
    expect(src).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/password\s*[:=]\s*['"]/);
    expect(src).toMatch(/getMasterSession/);
  });
});
