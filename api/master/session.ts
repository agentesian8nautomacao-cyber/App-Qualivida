/**
 * GET /api/master/session — Function Node (req, res).
 * Import estático: o import() dinâmico não entra no bundle da Vercel (stage entry).
 * Sem .fetch. Sem SDK Supabase.
 */
import { runMasterNodeHandler } from './_lib/nodeEntry';

export default async function handler(req: unknown, res?: unknown) {
  return runMasterNodeHandler(req, res);
}
