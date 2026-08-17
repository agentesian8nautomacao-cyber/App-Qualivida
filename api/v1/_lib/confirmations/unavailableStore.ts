/**
 * Production default until FUTURE MIGRATION provides persistent confirmation store.
 * Fail-closed: cannot create or validate durable single-use confirmations.
 */

import type { ConfirmationStore } from './types';

export function createUnavailableConfirmationStore(): ConfirmationStore {
  return {
    kind: 'unavailable',
    async create() {
      throw new Error('CONFIRMATION_STORE_UNAVAILABLE');
    },
    async get() {
      return null;
    },
    async markUsed() {
      return false;
    }
  };
}
