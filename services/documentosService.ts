import { supabase } from './supabase';

/** Nome do bucket no Supabase Storage. Criar em Storage → New bucket → "documentos" (público para leitura). */
const BUCKET = 'documentos';

export interface DocumentoItem {
  path: string;
  name: string;
  categoryId: string;
}

/**
 * Lista arquivos do bucket de documentos, agrupados por categoria (pasta).
 * categoryIds: ids das pastas a listar (ex.: ['inadimplencia', 'receitas-despesas']).
 */
export async function listDocumentos(
  categoryIds: string[]
): Promise<DocumentoItem[]> {
  const files: DocumentoItem[] = [];
  for (const categoryId of categoryIds) {
    const { data, error } = await supabase.storage.from(BUCKET).list(categoryId, { limit: 100 });
    if (error) continue;
    (data || []).forEach((item) => {
      if (item.name && item.id !== undefined && !item.name.startsWith('.')) {
        files.push({
          path: `${categoryId}/${item.name}`,
          name: item.name,
          categoryId
        });
      }
    });
  }
  return files;
}

/**
 * Retorna URL pública para download de um documento.
 */
export function getDocumentoPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? '';
}

/**
 * Upload de documento para o bucket na pasta da categoria.
 * categoryId: id da categoria (ex.: 'inadimplencia', 'receitas-despesas').
 */
export async function uploadDocumento(
  file: File,
  categoryId: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${categoryId}/${Date.now()}_${sanitized}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });

  if (error) {
    return { error: error.message };
  }

  const publicUrl = getDocumentoPublicUrl(path);
  return { path, publicUrl };
}
