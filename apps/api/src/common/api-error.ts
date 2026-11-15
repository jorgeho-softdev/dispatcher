import type { ErrorCode } from '@dispatcher/shared';

/**
 * Body for Nest HTTP exceptions: a stable `code` the clients translate
 * (packages/i18n → errors.<CODE>) plus an English developer message.
 *   throw new NotFoundException(apiError('NOT_FOUND', 'Vehicle not found'));
 */
export function apiError(code: ErrorCode, message: string) {
  return { code, message };
}
