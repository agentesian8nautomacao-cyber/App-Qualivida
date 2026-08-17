/**
 * GET /api/v1/events
 * G7-K — Admin Event Store query (tenant-scoped, events.view).
 *
 * Flow: HMAC → Tenant → AuthZ(list_events / events.view) → Event Store adapter → sanitized response
 * READ only. No Core. No confirmation. No idempotency mutation. No persistent obs event for the query itself.
 */

export const runtime = 'nodejs';

import {
  withAuthorizedOperation,
  resolveEventStoreQuery,
  type ApiHandlerDeps
} from './_lib/protectedHandler';
import { jsonSuccess, jsonError } from './_lib/response';
import { ApiErrorCodes } from './_lib/errors';
import { parseEventsListParams } from './_lib/observability/eventStoreQuery';
import { assertNoSensitiveLeak } from './_lib/observability/redact';

export function createEventsHandler(deps?: ApiHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withAuthorizedOperation(
        request,
        ['GET'],
        'list_events',
        async (ctx) => {
          const url = new URL(ctx.request.url);
          const parsed = parseEventsListParams(url.searchParams, {
            organization_id: ctx.auth.organization_id,
            condominium_id: ctx.auth.condominium_id
          });

          if (!parsed.ok) {
            return jsonError(ctx.request_id, ApiErrorCodes.INVALID_REQUEST, parsed.message, {
              correlationId: ctx.correlation_id,
              operation: 'list_events',
              details: parsed.details
            });
          }

          const store = resolveEventStoreQuery(deps);
          const result = await store.listEvents(parsed.query);

          if (!result.ok) {
            const code =
              result.code === 'INVALID_REQUEST'
                ? ApiErrorCodes.INVALID_REQUEST
                : ApiErrorCodes.INTERNAL_ERROR;
            return jsonError(ctx.request_id, code, result.message, {
              correlationId: ctx.correlation_id,
              operation: 'list_events',
              details: result.details
            });
          }

          const payload = {
            operation: 'list_events',
            core_executed: false,
            events: result.events,
            pagination: {
              limit: result.limit,
              next_cursor: result.next_cursor,
              count: result.events.length
            }
          };

          const leaks = assertNoSensitiveLeak(payload);
          if (leaks.length) {
            return jsonError(
              ctx.request_id,
              ApiErrorCodes.INTERNAL_ERROR,
              'response redaction failed',
              {
                correlationId: ctx.correlation_id,
                operation: 'list_events'
              }
            );
          }

          return jsonSuccess(ctx.request_id, payload, {
            correlationId: ctx.correlation_id,
            operation: 'list_events'
          });
        },
        deps
      );
    }
  };
}

export default createEventsHandler();
