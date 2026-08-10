# CORS no Supabase — QualiVida Club Residence

Para o login e as chamadas à API do Supabase funcionarem em **todos os ambientes**, é obrigatório liberar as origens (CORS) no painel do Supabase.

## Onde configurar

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e selecione o projeto.
2. Vá em **Authentication** → **URL Configuration** (ou **Settings** → **API**, conforme a versão do painel).
3. Em **Redirect URLs** ou **Site URL** / **Additional Redirect URLs**, inclua as URLs abaixo.

## URLs a liberar

| Ambiente        | URL a adicionar                    |
|-----------------|------------------------------------|
| **Produção (uso atual)** | `https://qualivida-club-residence.vercel.app` — síndico e moradores acessam por aqui até a implementação no condomínio. |
| Localhost (dev) | `http://localhost:3008`            |
| Rede interna (dev:local) | `http://localhost:5173`       |
| Rede interna (condomínio) | `http://192.168.x.x:5173` — **adicionar no Supabase somente quando o cliente autorizar a implementação no condomínio** (use o IP real do PC da portaria). |

Para rede interna, se o Supabase aceitar apenas URLs completas, adicione uma por máquina (ex.: `http://192.168.1.10:5173`, `http://192.168.1.10:3000` se usar `serve` em outra porta).

## Supabase local (rede interna)

Se estiver usando **Supabase local** (ex.: `http://192.168.0.10:54321`), configure CORS/redirect no próprio projeto Supabase local (config do Auth, se aplicável).

## Sem isso

- O login pode falhar com erro de CORS.
- Redirects pós-login ou recuperação de senha podem ser bloqueados.

## Garantias (Parte 9)

- Estrutura de rotas: **não alterada**
- Banco atual: **não alterado**
- Lógica de autenticação: **não alterada**
- Deploy atual (Vercel): **não alterado**

Tudo continua funcionando como hoje; apenas novas origens são adicionadas no Supabase.
