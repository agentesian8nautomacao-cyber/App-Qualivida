export const runtime = 'nodejs';

import { createLazyFetchHandler } from '../../_lib/vercelHandler';

export default createLazyFetchHandler(async () => {
  const { handleLiveMasterRequest } = await import('../_lib/live');
  return handleLiveMasterRequest;
});
