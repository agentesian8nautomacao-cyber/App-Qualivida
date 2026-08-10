# Opção: banco de dados local no condomínio

O sistema hoje usa **Supabase em nuvem**. Este documento descreve a **opção de banco local** para quando o cliente preferir que os dados fiquem dentro da rede do condomínio (Supabase self-hosted). Nenhuma alteração de código é necessária: a escolha é feita por **variáveis de ambiente**.

---

## Cenários suportados

| Cenário | Uso | Onde os dados ficam |
|--------|-----|----------------------|
| **Cloud (atual)** | Produção na Vercel + opcional rede interna apontando para o mesmo Supabase | Supabase (nuvem) |
| **Banco local** | Cliente opta por dados 100% na rede do condomínio | Supabase rodando em um servidor/PC na rede interna |

---

## Como funciona

A aplicação já usa apenas variáveis de ambiente para o Supabase:

- `VITE_SUPABASE_URL` — URL da API (cloud ou local)
- `VITE_SUPABASE_ANON_KEY` — chave anônima do projeto

Para **banco local**, basta apontar essas variáveis para a instância Supabase que rodar no condomínio. O código não muda.

---

## Quando o cliente optar por banco local: o que fazer

### 1. Instalar o Supabase local no condomínio

É necessário um **servidor ou PC fixo** na rede (ex.: no escritório da portaria ou em um pequeno servidor) com:

- **Docker** e **Docker Compose** instalados  
- Ou uso do [Supabase self-hosted](https://supabase.com/docs/guides/self-hosting) (recomendado: via Docker)

Passos resumidos:

1. Clonar o repositório oficial do Supabase para self-hosting ou usar o [Guia de self-hosting](https://supabase.com/docs/guides/self-hosting).
2. Configurar `.env` do Supabase (domínio, portas, etc.).
3. Subir os containers: `docker compose up -d`.
4. Anotar:
   - **URL da API** (ex.: `http://192.168.0.10:8000` ou a porta que o guia indicar; em setups típicos a API REST fica na 8000 e o Auth pode usar outra).
   - **Chave anônima (anon key)** do projeto local (gerada no primeiro setup).

> No setup padrão do Supabase com Docker, a **API URL** costuma ser `http://IP:54321` (Kong). O Studio fica em `http://IP:54323`. Use a URL que o seu guia de self-hosting indicar.

### 2. Schema e dados no banco local

- **Condomínio novo (sem histórico na nuvem):**  
  Rodar no Supabase local as **migrations** do projeto (pasta `migrations/` ou scripts SQL que você já usa no cloud). Assim as tabelas, RLS e funções ficam iguais.

- **Cliente que já usa o sistema na nuvem e quer migrar para local:**  
  Exportar dados do projeto cloud (backup/export do Supabase ou scripts próprios) e importar no banco local, além de rodar as migrations. Isso pode ser feito em um atendimento específico.

### 3. Configurar o app para usar o banco local

No ambiente onde você gera o build para o condomínio (ou no PC da portaria, se build for feito lá):

- Use o arquivo **`.env.localnet`** (ou **`.env.localnet.local`**, para não commitar segredos) com:

```env
VITE_SUPABASE_URL=http://192.168.0.10:54321
VITE_SUPABASE_ANON_KEY=<anon key do Supabase local>
VITE_APP_MODE=local
```

Substitua `192.168.0.10` pelo IP real do servidor onde o Supabase está rodando. A porta `54321` é a padrão da API no Supabase local (Docker); se usar outro setup, use a porta indicada. Use a **anon key** do projeto local (ex.: em Studio → Settings → API).

### 4. Build e execução no condomínio

- Gerar o build com o modo localnet (já usa `.env.localnet` / `.env.localnet.local`):

```bash
npm run build:local
```

- No PC da portaria (ou no servidor), servir a pasta gerada:

```bash
npm run serve:local
# ou: serve -s dist
```

- Acessar na rede por `http://<IP-do-PC>:3000` (ou a porta que o `serve` mostrar).

Detalhes: **docs/BUILD_LOCAL_ESTATICO.md**.

### 5. Autenticação e CORS no Supabase local

- No **Supabase local**, configurar em **Authentication → URL Configuration** (ou equivalente) as URLs de redirect permitidas, por exemplo:
  - `http://192.168.0.10:3000`
  - `http://<IP-do-PC-da-portaria>:3000`
  - Outras URLs que os moradores/portaria forem usar.

Assim o login e os redirects funcionam sem erro de CORS. Para Supabase em nuvem, use **docs/CORS_SUPABASE.md**.

---

## Checklist: implantar no condomínio com banco local

- [ ] Servidor/PC na rede do condomínio com Docker (ou ambiente compatível com Supabase self-hosted).
- [ ] Supabase local instalado e acessível na rede (API URL e anon key anotados).
- [ ] Schema aplicado no banco local (migrations ou scripts do projeto).
- [ ] `.env.localnet` ou `.env.localnet.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do Supabase **local**.
- [ ] Build gerado com `npm run build:local`.
- [ ] App servido com `npm run serve:local` (ou `serve -s dist`) no PC da portaria/servidor.
- [ ] URLs de redirect configuradas no Supabase local para o endereço em que o app é acessado (ex.: `http://IP:3000`).
- [ ] Teste de login e fluxos principais na rede interna.

---

## Resumo

- **Hoje:** tudo pode continuar usando Supabase em nuvem (Vercel + opcional rede interna).
- **Se o cliente optar por banco local:** instalar Supabase no condomínio, configurar URL e anon key no `.env.localnet` (ou `.env.localnet.local`), fazer `build:local` e `serve:local` e configurar redirects no Supabase local. O sistema já está preparado para isso; basta usar a opção quando for o caso.
