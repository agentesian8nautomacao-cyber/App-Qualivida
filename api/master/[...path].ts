/**
 * Catch-all /api/master/* — Function Node (req, res).
 * Import estático para o bundle da Vercel. Sem .fetch. Sem supabase-js.
 */
import { runMasterNodeHandler } from './_lib/nodeEntry';

export default async function handler(req: unknown, res?: unknown) {
  return runMasterNodeHandler(req, res);
}
