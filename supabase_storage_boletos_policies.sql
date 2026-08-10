-- Políticas RLS para permitir upload no Supabase Storage (bucket: boletos)
--
-- ERRO que isso corrige no client:
-- "StorageApiError: new row violates row-level security policy"
--
-- Pré-requisitos:
-- - Bucket criado com nome: boletos
-- - Idealmente bucket marcado como público para download (opcional, conforme sua política)
--
-- Execute no Supabase SQL Editor.

-- Permitir leitura dos objetos do bucket `boletos`
-- (se o bucket for público, isso costuma não ser necessário, mas é seguro deixar explícito)
create policy "boletos_read_all"
on storage.objects
for select
to public
using (bucket_id = 'boletos');

-- Permitir upload (insert) para usuários autenticados
create policy "boletos_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'boletos');

-- Permitir update (necessário para upsert=true em alguns cenários)
create policy "boletos_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'boletos')
with check (bucket_id = 'boletos');

-- (Opcional) Permitir delete para usuários autenticados (se quiser permitir remoção)
-- create policy "boletos_delete_authenticated"
-- on storage.objects
-- for delete
-- to authenticated
-- using (bucket_id = 'boletos');

