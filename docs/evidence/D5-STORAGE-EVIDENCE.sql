-- =============================================================================
-- D5 — STORAGE EVIDENCE / BUCKETS (somente leitura)
-- =============================================================================
-- Objetivo: exportar metadados de storage.buckets (público/privado, limites, MIME).
-- Ambiente: SQL Editor do projeto Supabase de produção (ref: zaemlxjwhzrfmowbckmk)
-- Fonte: docs/FASE-0-DIAGNOSTICO-PRODUCAO.md — Anexo D (bloco D5)
--
-- PROIBIDO neste script (e na execução desta etapa):
--   CREATE / ALTER / DROP / INSERT / UPDATE / DELETE /
--   criar/apagar buckets, apagar arquivos, alterar policies de Storage
--
-- Como usar:
--   1. Abrir SQL Editor no projeto correto
--   2. Colar e executar este arquivo inteiro
--   3. Exportar o resultado para:
--      docs/evidence/results/D5-STORAGE-EVIDENCE-<YYYY-MM-DD>.txt
--   4. Preencher docs/evidence/README.md (data/hora, responsável, ambiente)
-- =============================================================================

-- D5) Buckets
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY name;
