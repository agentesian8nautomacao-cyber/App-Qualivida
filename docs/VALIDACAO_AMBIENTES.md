# Critérios de Validação — Ambientes QualiVida

O sistema deve funcionar em **todos** os cenários abaixo, sem erro de CORS, sem URL fixa no código e sem quebra na autenticação.

## Tabela de status esperado

| Ambiente              | Comando / Como acessar                    | Status esperado |
|-----------------------|-------------------------------------------|-----------------|
| **Vercel (produção)** | URL do app na Vercel                      | ✅ |
| **Localhost**         | `npm run dev` → http://localhost:3008     | ✅ |
| **Rede interna**      | `npm run dev:local` → http://192.168.x.x:5173 (modo localnet) | ✅ |
| **Build estático local** | `npm run build:local` + `npm run serve:local` (ou `serve -s dist`) — ver `docs/BUILD_LOCAL_ESTATICO.md` | ✅ |

## Checklist de validação

- [ ] **Vercel (produção)** — Deploy atual abre, login funciona, sem erro no console.
- [ ] **Localhost** — `npm run dev` abre em localhost:3008, login e fluxos principais ok.
- [ ] **Rede interna** — `npm run dev:local` acessível em http://\<IP\>:5173 na rede; login ok.
- [ ] **Build estático local** — Após `npm run build:local`, rodar `npm run serve:local` (ou `serve -s dist`); abrir no navegador; login ok.
- [ ] **Sem erro de CORS** — Nenhum erro de CORS no console em nenhum ambiente (Supabase configurado conforme `docs/CORS_SUPABASE.md`).
- [ ] **Sem URL fixa** — Todas as URLs vêm de variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.).
- [ ] **Sem quebra na autenticação** — Login, logout, recuperação de senha e redirects funcionam como antes.

## Garantias (o que não foi alterado)

- Estrutura de rotas
- Banco atual
- Lógica de autenticação
- Deploy atual (Vercel)

Tudo deve continuar funcionando como hoje; os novos ambientes são **aditivos**.
