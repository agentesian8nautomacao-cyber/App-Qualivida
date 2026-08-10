# Deploy no Vercel — sobrescrever com o projeto atual

Para enviar **todo o projeto atual** e sobrescrever o deploy (sem depender de commits antigos nem cache):

## 1. Deploy pela CLI (recomendado)

Na pasta raiz do projeto:

```bash
# Instalar a CLI do Vercel (uma vez)
npm i -g vercel

# Fazer login (uma vez)
vercel login

# Enviar o projeto atual para produção, sem cache de build
npm run deploy:vercel
```

Ou direto:

```bash
vercel --prod --force
```

- **`--prod`** — publica em **Production** (mesmo domínio que o Git).
- **`--force`** — ignora cache de build; o Vercel faz um build do zero com os arquivos que estão na sua pasta.

Assim o deploy usa **exatamente o estado atual da pasta**, não um commit antigo. O projeto já vinculado no Vercel será atualizado.

## 2. Se o projeto ainda não estiver vinculado

Na primeira vez:

```bash
vercel
```

Siga o assistente (linkar ao projeto existente ou criar um novo). Depois use:

```bash
npm run deploy:vercel
```

## 3. Limpar resquícios pelo Dashboard (opcional)

1. Acesse [vercel.com](https://vercel.com) → seu projeto.
2. Abra o último deployment → **⋮** → **Redeploy**.
3. Marque **Clear Build Cache** e confirme.

Isso só limpa o cache do build; a origem do deploy continua sendo o que você escolheu (Git ou CLI).

## 4. Resumo

| Objetivo                         | Comando / Ação                          |
|----------------------------------|-----------------------------------------|
| Enviar pasta atual → Production | `npm run deploy:vercel` ou `vercel --prod --force` |
| Preview (teste) sem cache       | `npm run deploy:vercel:preview` ou `vercel --force` |
| Limpar cache no próximo deploy  | Redeploy no Dashboard com **Clear Build Cache** |

Depois do `vercel --prod --force`, o que está no ar é o estado atual do seu projeto, sem resquícios de commits antigos no build.
