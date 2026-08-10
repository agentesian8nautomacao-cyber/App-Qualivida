# Build local estático — PC da portaria

Permite rodar o sistema no PC da portaria **sem** o modo dev (Vite). Útil para rede interna com build já gerado.

## Passos

### 1. Gerar o build para rede local

```bash
npm run build:local
```

Isso usa o modo **localnet** e o arquivo `.env.localnet` (Supabase da rede interna, ex.: `http://192.168.0.10:54321`). Preencha `VITE_SUPABASE_ANON_KEY` em `.env.localnet` (ou em `.env.localnet.local` para não commitar).

### 2. Servir a pasta `dist`

**Opção A — Script do projeto (não precisa instalar globalmente):**

```bash
npm run serve:local
```

Isso executa `npx serve -s dist` (servidor estático na pasta `dist`).

**Opção B — Instalar `serve` globalmente:**

```bash
npm install -g serve
serve -s dist
```

Por padrão o `serve` sobe na porta 3000. Acesse no navegador: `http://localhost:3000` ou `http://192.168.x.x:3000` (IP do PC na rede).

### 3. Na rede interna

No PC da portaria (ou em qualquer máquina na mesma rede), abra:

- `http://<IP-do-PC>:3000` (se usou `serve -s dist` na porta padrão)
- Ou a porta que o `serve` informar no terminal

O sistema roda 100% estático; não é necessário rodar `npm run dev:local`.

## Garantias

- Estrutura de rotas: **não alterada**
- Banco atual: **não alterado**
- Lógica de autenticação: **não alterada**
- Deploy Vercel: **não alterado**

Tudo continua funcionando como hoje.
