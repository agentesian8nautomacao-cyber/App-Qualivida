export const runtime = 'nodejs';

import { handleLiveMasterRequest } from './_lib/live';

export default {
  fetch: handleLiveMasterRequest
};
