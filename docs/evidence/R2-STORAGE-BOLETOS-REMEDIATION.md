# R2 — Storage boletos: diagnóstico e proposta de remediação

**Status:** **DIAGNÓSTICO PRONTO** — migration **NÃO executada**  
**Data:** 2026-08-12  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Pré-requisito:** R1 = PASS (packages Allow all removida)  
**Fontes LIVE:** D2 + D5 (`docs/evidence/results/*-2026-08-12*`)  
**Código:** `services/dataService.ts`, views/modals de boletos, `supabase_storage_boletos_policies.sql`

**Nada alterado nesta tarefa** (banco, Storage, policies, código, deploy).

---

## Problema

D2 e D5 falharam porque:

1. **`storage.objects` policy `boletos_read_all`:** `SELECT` para `{public}` com `USING (bucket_id = 'boletos')` — qualquer cliente (incl. anon) pode ler objetos do bucket se conhecer o path.
2. **Bucket `boletos` com `public = true`:** habilita URLs no formato `/storage/v1/object/public/boletos/...` sem sessão.

Juntos, PDFs financeiros ficam potencialmente públicos. Não há isolamento por tenant/site no path nem nas policies.

---

## Estado LIVE

### Policies `storage.objects` relacionadas a `boletos` (D2)

| policy name | command | permissive | roles | USING | WITH CHECK |
|-------------|---------|------------|-------|-------|------------|
| **boletos_read_all** | SELECT | PERMISSIVE | **{public}** | `(bucket_id = 'boletos'::text)` | null |
| boletos_insert_authenticated | INSERT | PERMISSIVE | {authenticated} | null | `(bucket_id = 'boletos'::text)` |
| boletos_update_authenticated | UPDATE | PERMISSIVE | {authenticated} | `(bucket_id = 'boletos'::text)` | `(bucket_id = 'boletos'::text)` |

**Total relevante:** 3 policies.  
**DELETE:** não há policy live de delete para boletos (no repo, `boletos_delete_authenticated` está comentada).

Nenhuma outra policy de `storage.objects` apareceu no export D2 além dessas três (o script D2 lista todas de `storage.objects`).

### Bucket `storage.buckets` (D5)

| Campo | Valor LIVE |
|-------|------------|
| id | `boletos` |
| name | `boletos` |
| **public** | **true** |
| file_size_limit | null |
| allowed_mime_types | null |
| created_at | 2026-02-03 01:23:00.853485+00 |

**Confirmação explícita:** `public = true`.

---

## Causa / risco

| Fator | Risco |
|-------|--------|
| Bucket público | URL estável pública se o path for conhecido ou vazado |
| SELECT `{public}` | API Storage permite leitura sem autenticação (além da URL pública) |
| Path previsível | `original/{boletoId}.pdf` — UUID no nome, mas ainda sem auth se público |
| **Tenant scope ausente no Storage atual** | Sem `organization_id` / `condominium_id` / `site_id` no path ou na policy |

---

## Frontend — ocorrências relevantes

| Arquivo | Função/componente | Operação | Finalidade | Perfil | Path |
|---------|-------------------|----------|------------|--------|------|
| `services/dataService.ts` | `uploadBoletoOriginalPdf` | `.upload()` bucket `boletos` | Guardar PDF original + checksum | Sessão Auth (staff/admin import) | `original/{boletoId}.pdf` |
| `services/dataService.ts` | `downloadBoletoOriginalPdf` | `.download()` bucket `boletos` | Baixar PDF + verificar checksum → blob URL | Sessão Auth (UI boletos) | `pdf_original_path` |
| `services/dataService.ts` | `addBoletoOriginalPdf` | upload + update row tabela `boletos` | Anexar PDF a boleto existente | Auth | idem |
| `services/boletoPdfImportService.ts` | import flow | chama `uploadBoletoOriginalPdf` | Importação em lote | Auth | idem |
| `components/modals/ImportBoletosModal.tsx` | import UI | upload | Importação modal | Staff/síndico | idem |
| `components/views/BoletosView.tsx` | download UI | `downloadBoletoOriginalPdf` **ou** `boleto.pdfUrl` legacy | Download/visualização | Staff / quem vê a tela | path storage ou URL legada |
| `App.tsx` | handlers boleto | `downloadBoletoOriginalPdf` | Download | Auth | path |
| `components/views/MoradorDashboardView.tsx` | UI | indica presença de PDF | Morador | — | flags path/url |
| `services/documentosService.ts` | `getDocumentoPublicUrl` | `.getPublicUrl()` | Bucket **`documentos`**, **não** `boletos` | — | N/A R2 |

### Busca signed URL

| API | Uso no fluxo de boletos |
|-----|-------------------------|
| `.createSignedUrl` / `.createSignedUrls` | **Ausente** no fluxo boletos |
| `.getPublicUrl` em bucket `boletos` | **Ausente** no código de PDF original |
| `.download()` | **Presente** — caminho principal |

**Existência de signed URLs no fluxo boletos:** **NÃO**.

---

## Fluxo mapeado

### UPLOAD

| Pergunta | Resposta |
|----------|----------|
| Quem? | Staff autenticado (import boletos / anexar PDF) |
| Bucket? | `boletos` |
| Path? | `original/{boletoId}.pdf` |
| Auth? | `supabase.auth.getSession()` obrigatória; falha sem sessão |
| Policy? | `boletos_insert_authenticated` (+ `boletos_update_authenticated` se upsert) |
| Tabela? | Metadados em `public.boletos` (`pdf_original_path`, `checksum_pdf`); `pdf_url` legado limpo no attach |

### DOWNLOAD

| Pergunta | Resposta |
|----------|----------|
| Quem? | Usuário autenticado na UI (BoletosView / App); morador vê indicador |
| Bucket? | `boletos` (quando `pdf_original_path`) |
| Path? | valor de `pdf_original_path` |
| Método principal? | **`.download()` direto** → blob URL local |
| Signed URL? | **Não** |
| Public URL? | **Não** no fluxo original; **fallback** `boleto.pdfUrl` se path ausente (legado — pode ser URL pública antiga) |
| Policy SELECT atual? | Efetivamente `boletos_read_all` (public) — também cobre authenticated |

### DELETE

| Pergunta | Resposta |
|----------|----------|
| Existe policy Storage delete? | **NÃO** (live); opcional comentada no script repo |
| Quem pode? | N/A via Storage policy; limpeza seria service_role / dashboard |

### UPDATE (objeto Storage)

| Pergunta | Resposta |
|----------|----------|
| Existe? | **SIM** — `boletos_update_authenticated` (suporta `upsert: true` no upload) |
| Quem? | authenticated |

---

## Isolamento multi-tenant

**Tenant scope ausente no Storage atual.**

| Elemento | Presente? |
|----------|-----------|
| organization_id / condominium_id / site_id no path | **NÃO** |
| resident_id / user_id / staff_id na policy Storage | **NÃO** |
| Path pattern | **`original/{boletoId}.pdf`** apenas |
| Prefixos `organizations/…`, `condominiums/…`, `sites/…`, `residents/…` | **NÃO** usados |

Isolamento, se houver, está só na tabela `public.boletos` (hoje também com policies permissivas D2 — fora do escopo R2 Storage). Quem obtém o path (ou UUID) + acesso Storage lê o PDF.

---

## Compatibilidade com `public = false`

| Mecanismo | Continua funcionando se bucket privado? |
|-----------|----------------------------------------|
| `.upload()` autenticado | **SIM**, se INSERT/UPDATE policies permanecerem |
| `.download()` autenticado | **SIM somente se** existir policy **SELECT** para `authenticated` (hoje a única SELECT é pública) |
| Signed URLs | Não usadas; opcional no futuro |
| Public URLs / `pdfUrl` legado apontando para `/object/public/boletos/...` | **QUEBRAM** |

### REVIEW REQUIRED (antes de executar R2)

1. **Inventário de `pdf_url` legados** em produção: quantos boletos ainda dependem de URL pública vs só `pdf_original_path`?  
   Sem isso, risco de regressão na UI que faz `else if (boleto.pdfUrl)`.
2. **Policy SELECT pós-remoção de `boletos_read_all`:** é **obrigatório** criar `SELECT` para `authenticated` (mínimo) — senão `.download()` quebra para todo mundo.  
   Escopo mais fino (só dono do boleto / staff) **não está implementado no Storage hoje** e exigiria join com `public.boletos` + auth mapping — **REVIEW REQUIRED** se a meta for “morador só o seu PDF” no Storage (não só na tabela).

Para R2 **mínima** (fechar D5 + leitura pública):  
remover read_all + `public=false` + **adicionar** SELECT authenticated no bucket — alinhado ao código atual de `.download()` com sessão.

Para R2 **estrita** (morador/staff por linha): falta desenho de policy com subquery — **não inventar** sem validar `auth.uid()` ↔ `residents`/`users` e RLS da tabela `boletos`.

---

## Correção proposta (NÃO executar)

### Objetivo R2 mínima (recomendada como primeiro passo)

1. Remover policy `"boletos_read_all"`.  
2. Tornar bucket `boletos` **`public = false`**.  
3. Manter `boletos_insert_authenticated` e `boletos_update_authenticated`.  
4. **Criar** `boletos_select_authenticated` (`SELECT` TO `authenticated` USING `bucket_id = 'boletos'`).  
5. Não criar DELETE salvo necessidade explícita.  
6. Signed URLs: **não obrigatórias** se `.download()` + SELECT authenticated forem suficientes.  
7. Isolamento tenant/site: **fora** desta R2 mínima; path canônico Operaut fica para M15 / fase posterior.

### Migration R2 — SQL proposto (PROPOSTA ONLY)

```sql
-- =============================================================================
-- R2 PROPOSTA — Storage boletos: privado + SELECT autenticado
-- NÃO EXECUTAR sem autorização explícita + inventário pdf_url
-- Project: zaemlxjwhzrfmowbckmk
-- =============================================================================

BEGIN;

-- 1) Remover leitura pública
DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;

-- 2) SELECT para usuários autenticados (necessário para .download() no app)
DROP POLICY IF EXISTS "boletos_select_authenticated" ON storage.objects;
CREATE POLICY "boletos_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'boletos');

-- 3) Bucket privado
UPDATE storage.buckets
SET public = false
WHERE id = 'boletos';

-- Insert/update existentes: NÃO alterar nesta proposta
-- (boletos_insert_authenticated / boletos_update_authenticated)

COMMIT;
```

### Rollback emergencial (não solução normal)

```sql
BEGIN;

DROP POLICY IF EXISTS "boletos_select_authenticated" ON storage.objects;

DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;
CREATE POLICY "boletos_read_all"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'boletos');

UPDATE storage.buckets
SET public = true
WHERE id = 'boletos';

COMMIT;
```

---

## Testes (quando R2 for autorizada)

### Segurança

- [ ] anon: `.download` / GET objeto → DENY  
- [ ] authenticated sem relação com boletos: com policy mínima SELECT authenticated → ainda pode baixar se souber o path (**limitação conhecida**; marcar dívida)  
- [ ] morador/staff: com sessão, download via UI OK  
- [ ] tenant A ≠ B: **N/A até path/policy multi-tenant** — declarar dívida Operaut  

### Funcional

- [ ] Upload / import PDF  
- [ ] Download PDF original + checksum  
- [ ] Visualização via blob URL  
- [ ] Fallback `pdfUrl`: documentar quantos quebram / migrar para path  

### Storage

- [ ] `storage.buckets.public = false` para `boletos`  
- [ ] `boletos_read_all` ausente  
- [ ] `boletos_select_authenticated` presente  
- [ ] insert/update authenticated presentes  

---

## Ordem operacional sugerida

1. Backup verificável  
2. Query inventário `pdf_url` / `pdf_original_path` (read-only)  
3. Autorizar R2 mínima  
4. Aplicar SQL proposto  
5. Arquivar evidência pós (`R2-STORAGE-BOLETOS-POST-*.txt`)  
6. Planejar R2b (SELECT por ownership) + path multi-tenant (M15)  

---

## Fora de escopo R2

- packages / R1  
- staff_invites  
- policies `USING true` da tabela `public.boletos`  
- bucket `documentos`  
- execução / deploy / mudança de código  

---

*R2 = DIAGNÓSTICO PRONTO. Migration não executada.*
