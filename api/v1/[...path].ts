import { createLazyFetchHandler } from '../_lib/vercelHandler';

export default createLazyFetchHandler(async () => {
  const { routeV1Request } = await import('./_lib/router');
  return routeV1Request;
});
