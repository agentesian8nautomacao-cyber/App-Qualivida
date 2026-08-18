export const runtime = 'nodejs';

import { routeV1Request } from './_lib/router';
import { asVercelFetchExport } from '../_lib/vercelHandler';

export default asVercelFetchExport(routeV1Request);
