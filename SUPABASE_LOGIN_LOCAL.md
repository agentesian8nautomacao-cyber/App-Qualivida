# Login local (localhost:3007) — Supabase

Se o app abre em http://localhost:3007/ mas **não reconhece credenciais** (erro ao buscar usuários, morador, portaria, síndico), verifique:

---

## Login não funciona em local e Vercel (Supabase ativo)

Se o **Supabase não está pausado** e o login falha nos dois ambientes (ou só na Vercel), a causa mais comum é:

1. **RLS (Row Level Security)** nas tabelas `users` e `residents` sem política que permita **SELECT** para a role **anon**.  
   → O app usa a chave anônima para buscar usuário/morador; se RLS bloquear, a consulta devolve 0 linhas e a tela mostra "Usuário ou senha inválidos" mesmo com credenciais corretas.  
   → **Solução:** executar no Supabase (SQL Editor) as políticas da seção **3. RLS** abaixo.

2. **Vercel sem variáveis de ambiente**  
   → No projeto na Vercel: **Settings** → **Environment Variables**.  
   → Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmos valores do Dashboard do Supabase → Project Settings → API).  
   → Faça um **redeploy** após salvar (as variáveis `VITE_*` são embutidas no build).

3. **URLs de redirect do Auth (se usar login por e-mail/senha do Supabase Auth)**  
   → No Supabase: **Authentication** → **URL Configuration** → **Redirect URLs**.  
   → Inclua `http://localhost:3007/**` e a URL da sua app na Vercel (ex.: `https://seu-app.vercel.app/**`).

---

## 1. Variáveis de ambiente

No `.env.local` (na raiz do projeto):

- `VITE_SUPABASE_URL` — URL do projeto (ex: `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — chave anônima (Project Settings → API)

**Importante:** após alterar `.env.local`, **reinicie o servidor** (`Ctrl+C` e de novo `npm run dev`). O Vite só carrega o `.env` na subida.

## 2. URL permitida no Supabase (Auth)

No **Supabase Dashboard**:

1. **Authentication** → **URL Configuration**
2. Em **Redirect URLs**, inclua: `http://localhost:3007/**`
3. Em **Site URL** (opcional para dev): pode deixar o de produção ou usar `http://localhost:3007`

Isso evita bloqueios de CORS/Auth ao fazer login a partir do localhost.

## 3. RLS (Row Level Security)

O login lê as tabelas `users` (admin/porteiro/síndico) e `residents` (morador) usando a chave **anon**. Se RLS estiver ativo e não houver política que permita esse acesso, as consultas falham e o app mostra “erro ao buscar usuários” / “erro ao buscar morador”.

No **SQL Editor** do Supabase, você pode:

**Opção A — Permitir SELECT anon para login (desenvolvimento):**

```sql
-- Tabela users (admin/porteiro/síndico)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para login (anon)"
ON public.users FOR SELECT
TO anon
USING (true);

-- Tabela residents (morador)
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para login morador (anon)"
ON public.residents FOR SELECT
TO anon
USING (true);
```

(Em produção, convém restringir essas políticas em vez de `USING (true)`.)

**Opção B — Desativar RLS só para dev (não recomendado em produção):**

```sql
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents DISABLE ROW LEVEL SECURITY;
```

## 4. Erro "nome do servidor não resolvido" (ERR_NAME_NOT_RESOLVED)

Se no Console aparecer **Failed to load resource: net::ERR_NAME_NOT_RESOLVED** ou **Failed to fetch** ao tentar login, o **navegador não consegue resolver o hostname do Supabase** (ex.: `zaemlxjwhzrfmowbckmk.supabase.co`). Isso é falha de **DNS/rede neste computador ou rede**, não do código nem do projeto Supabase.

**O que fazer (testar na ordem):**

1. **Outra rede**  
   Use o celular como **hotspot** e conecte o PC a ele. Tente o login de novo. Se funcionar, o bloqueio está na rede anterior (empresa, provedor, etc.).

2. **Trocar o DNS do Windows**  
   - **Configurações** → **Rede e Internet** → **Wi‑Fi** (ou Ethernet) → **Propriedades do adaptador** (ou **Editar opções de compartilhamento** e depois o adaptador).  
   - Ou: **Painel de Controle** → **Central de Rede** → **Alterar configurações do adaptador** → botão direito no adaptador em uso → **Propriedades** → **Protocolo IP versão 4 (TCP/IPv4)** → **Propriedades** → **Usar os seguintes endereços de servidor DNS:**  
   - Preferencial: `8.8.8.8` | Alternativo: `8.8.4.4` (Google) ou `1.1.1.1` (Cloudflare).  
   - Salve, feche e tente o login de novo.

3. **Desativar VPN**  
   Se estiver usando VPN, desative e teste de novo.

4. **Testar no navegador**  
   Abra uma nova aba e acesse:  
   `https://zaemlxjwhzrfmowbckmk.supabase.co/rest/v1/`  
   (use o seu ref do projeto no lugar de `zaemlxjwhzrfmowbckmk` se for outro).  
   - Se a página não carregar (mesmo erro de nome não resolvido), o problema é DNS/rede.  
   - Se carregar (pode aparecer erro 401 ou JSON), a rede está resolvendo; aí vale conferir variáveis de ambiente e RLS.

5. **Projeto pausado**  
   No [Dashboard](https://supabase.com/dashboard) → seu projeto → **Project Settings** → **General**, veja se está pausado e use **Restore project** se precisar.

6. **URL no .env**  
   Confira se `VITE_SUPABASE_URL` em `.env.local` está exatamente como no Dashboard (Project Settings → API), por exemplo `https://seu-ref.supabase.co` (sem barra no final). Reinicie `npm run dev` após alterar.

## 5. Conferir erro no navegador

1. Abra **F12** → aba **Console**.
2. Tente fazer login.
3. Se aparecer `[userAuth] Erro ao buscar usuário no Supabase:` ou `[residentAuth] Erro ao buscar moradores no Supabase:`, o texto que vem em seguida é o erro real (ex.: RLS, rede, tabela inexistente).

Com isso, o app em http://localhost:3007/ consegue falar com o Supabase e reconhecer as credenciais de admin, portaria, síndico e morador.
