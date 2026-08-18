/**
 * Entry Vercel — nenhum import estático.
 * Import no topo (factory / .fetch) causava FUNCTION_INVOCATION_FAILED no cold start.
 */
export default async function handler(req: unknown, res?: unknown) {
  try {
    const { runSafeApiHandler } = await import('../_lib/safeApiHandler');
    return await runSafeApiHandler(req, res, 'master');
  } catch (err: unknown) {
    const request_id = `m_${Date.now().toString(36)}`;
    const exception = err instanceof Error ? err.name : 'Error';
    const payload = JSON.stringify({
      error: 'MASTER_API_ERROR',
      message: 'Falha ao iniciar a API Master',
      request_id,
      stage: 'entry',
      exception
    });
    console.error(
      JSON.stringify({
        src: 'master-entry',
        request_id,
        stage: 'entry',
        exception,
        has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        has_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
      })
    );
    const node = res as { statusCode?: number; setHeader?: (k: string, v: string) => void; end?: (b?: string) => void } | undefined;
    if (node && typeof node.end === 'function') {
      node.statusCode = 500;
      try {
        node.setHeader?.('Content-Type', 'application/json');
      } catch {
        /* ignore */
      }
      node.end(payload);
      return;
    }
    return new Response(payload, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
