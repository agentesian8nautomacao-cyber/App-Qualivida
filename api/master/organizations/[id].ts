export const runtime = 'nodejs';

import { handleLiveMasterRequest } from '../_lib/live';
import { asVercelFetchExport } from '../../_lib/vercelHandler';

export default asVercelFetchExport(handleLiveMasterRequest);
