/**
 * SENTINELA AUT — Operational Core public API
 *
 * UI / future n8n → Core → dataService adapters → DB
 * No React, no WhatsApp, no n8n, no DDL.
 */

export * from './types';
export * from './context';
export {
  publishDomainEvents,
  subscribeDomainEvents,
  getRecentDomainEvents,
  clearRecentDomainEventsForTests
} from './domain/events';
export { hasReservationConflict, timesOverlap } from './domain/reservationConflict';
export type { ReservationSlot } from './domain/reservationConflict';
export {
  validateReservationTimeRange,
  isReservationCanceledStatus,
  isExclusionViolationError,
  RESERVATION_STATUS_CANCELED
} from './domain/reservationTime';

export { identifyResident } from './operations/identifyResident';
export type { IdentifyResidentInput, IdentifyResidentData } from './operations/identifyResident';

export { identifyUnit } from './operations/identifyUnit';
export type { IdentifyUnitInput, IdentifyUnitData } from './operations/identifyUnit';

export { createPackage } from './operations/createPackage';
export type { CreatePackageInput, CreatePackageData } from './operations/createPackage';

export { pickupPackage } from './operations/pickupPackage';
export type { PickupPackageInput, PickupPackageData } from './operations/pickupPackage';

export { createOccurrence, updateOccurrence } from './operations/createOccurrence';
export type {
  CreateOccurrenceInput,
  CreateOccurrenceData,
  UpdateOccurrenceInput
} from './operations/createOccurrence';

export { createReservation, cancelReservation } from './operations/createReservation';
export type {
  CreateReservationInput,
  CreateReservationData,
  CancelReservationInput
} from './operations/createReservation';

export { getBoleto, notifyResident } from './operations/getBoleto';
export type { GetBoletoInput, GetBoletoData, NotifyResidentInput } from './operations/getBoleto';

export { setCorePersistenceForTests } from './adapters/persistence';
export type { CorePersistence } from './adapters/persistence';
