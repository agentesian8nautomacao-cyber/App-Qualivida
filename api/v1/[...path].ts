export const runtime = 'nodejs';

import { routeV1Request } from './_lib/router';
import { asVercelNodeHandler } from '../_lib/vercelHandler';

export default asVercelNodeHandler(routeV1Request);
