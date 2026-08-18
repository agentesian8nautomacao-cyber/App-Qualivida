/**
 * Entry Vercel — nenhum import estático.
 */
export default async function handler(req: unknown, res?: unknown) {
  try {
    const { runSafeApiHandler } = await import('../../_lib/safeApiHandler');
    return await runSafeApiHandler(req, res, 'master');
  } catch (err: unknown) {
    const payload = JSON.stringify({
      error: 'MASTER_API_ERROR',
      message: 'Falha ao iniciar a API Master',
      request_id: `m_${Date.now().toString(36)}`,
      stage: 'entry',
      exception: err instanceof Error ? err.name : 'Error'
    });
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
