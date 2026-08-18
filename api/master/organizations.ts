export const runtime = 'nodejs';

import { handleLiveMasterRequest } from './_lib/live';
import { asVercelNodeHandler } from '../_lib/vercelHandler';

export default asVercelNodeHandler(handleLiveMasterRequest);
