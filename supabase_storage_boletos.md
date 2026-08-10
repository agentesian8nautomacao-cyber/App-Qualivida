# Storage: bucket de PDFs de boletos

Para que os PDFs importados na página **Boletos** fiquem disponíveis para visualização e para designação ao morador, é necessário criar um bucket no **Supabase Storage**.

## Passos no Supabase

1. Acesse o projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. No menu lateral, abra **Storage**.
3. Clique em **New bucket**.
4. Configure:
   - **Name:** `boletos`
   - **Public bucket:** marque como **Sim** (público), para que as URLs dos PDFs funcionem para visualização e download.
5. Salve.

## Passo obrigatório: liberar upload (RLS do Storage)

Mesmo com bucket público, o **upload** pode falhar com:

`StorageApiError: new row violates row-level security policy`

Isso acontece porque o Supabase Storage usa a tabela `storage.objects` com **RLS** e, por padrão, não permite `INSERT/UPDATE`.

Execute no **SQL Editor** o arquivo:

- `supabase_storage_boletos_policies.sql`

Após aplicar as policies, a importação de boletos com PDF anexado passa a:

- enviar o PDF original para o Storage (`boletos/original/{uuid}.pdf`)
- salvar o caminho (`pdf_original_path`) e checksum no registro do boleto
- permitir que síndico/morador baixem exatamente o PDF original
