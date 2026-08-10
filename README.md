<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# App Qualivida - Gestão Condominial

Sistema de gestão condominial com IA integrada usando Gemini API.

## 🚀 Deploy no Vercel

Este projeto está configurado para deploy automático no Vercel.

### Configuração no Vercel

1. Conecte seu repositório GitHub ao Vercel
2. Em **Settings → Environment Variables**, configure:
   - `VITE_SUPABASE_URL` — URL do projeto Supabase (ex.: `https://xxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — Chave anônima do Supabase
   - `GEMINI_API_KEY` — Chave da API Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))
   - `VITE_SENTRY_DSN` — (opcional) DSN do Sentry para monitoramento de erros
3. O Vercel detectará automaticamente o framework Vite e fará o build

### Migrations Supabase (ocorrências visíveis para o admin)

Para que **ocorrências criadas pelo morador** apareçam na tabela `occurrences` do Supabase e na interface do admin/síndico, execute no SQL do seu projeto Supabase (Dashboard → SQL Editor) as migrations nesta ordem:

1. **`migrations/009_occurrences_rls_allow_insert_select.sql`** — políticas RLS que permitem INSERT (morador) e SELECT (todos).
2. **`migrations/010_occurrences_add_updated_at.sql`** — colunas `updated_at`, `image_url`, `messages` na tabela `occurrences`.

Sem essas migrations, o app ainda mostra a ocorrência para o morador (cache local), mas o insert no banco falha e o admin não vê a ocorrência.

### Arquivos de Configuração

- `vercel.json` - Configuração do deploy no Vercel
- `vite.config.ts` - Configuração do Vite (porta 3008 para desenvolvimento local)
- `package.json` - Dependências do projeto

## 📦 Instalação Local

**Pré-requisitos:** Node.js 18+ e npm

1. Clone o repositório:
   ```bash
   git clone https://github.com/agentesian8nautomacao-cyber/Gestao-Qualivida-Residence.git
   cd GestaoQualividaResidence
   ```

2. Instale as dependências:
   ```bash
   # Use yarn (recomendado) ou npm
   yarn install
   # OU
   npm install --legacy-peer-deps
   ```
   
   **Nota:** Se encontrar problemas com npm em caminhos com espaços no Windows, use yarn:
   ```bash
   yarn add vite@6.2.0 @vitejs/plugin-react@5.1.2 --dev
   ```

3. Configure as variáveis de ambiente:
   - Copie `.env.example` para `.env.local`
   - Preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` (e opcionalmente `VITE_SENTRY_DSN`)

4. Execute o projeto:
   ```bash
   npm run dev
   ```

5. Acesse: http://localhost:3007

## 🛠️ Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento (porta 3007)
- `npm run dev` - Inicia o servidor de desenvolvimento (porta 3008)
- `npm run build` - Gera o build de produção
- `npm run preview` - Preview do build de produção

## 📝 Dependências Principais

- React 19.2.3
- Vite 6.2.0
- TypeScript 5.8.2
- @google/genai 1.34.0 (Gemini API)
- Recharts 3.6.0 (Gráficos)
- Lucide React 0.562.0 (Ícones)

## 🔧 Troubleshooting

Se encontrar problemas com a instalação do Vite localmente:

1. **Use Yarn (recomendado para Windows com caminhos que contêm espaços):**
   ```bash
   yarn install
   # ou instale apenas o vite
   yarn add vite@6.2.0 @vitejs/plugin-react@5.1.2 --dev
   ```

2. Limpe o cache do npm:
   ```bash
   npm cache clean --force
   ```

3. Remova node_modules e reinstale:
   ```bash
   rm -rf node_modules package-lock.json
   npm install --legacy-peer-deps
   ```

4. O Vercel fará a instalação correta durante o deploy, mesmo que haja problemas locais.

## 🔐 LGPD / Operação

Modelos e procedimentos mínimos (Política de Privacidade, Termos de Uso, Controlador/Operador e operação/auditoria/SLA) estão em `LGPD/documentos/README.md`.

## 📄 Licença

Este projeto é privado.
