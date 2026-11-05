import { ERROR_NAMES, PRISMA_TRANSACTION_CONFLICT_CODE, TRANSACTION_CONFLICT_MESSAGES } from '../configs/constants.js';

/**
 * Add safe operation context to database failures without exposing Prisma's
 * SQL, connection details, or stack trace to the client.
 */
export function databaseError(functionName, operation, error) {
  const wrapped = new Error(`Unable to ${operation} in ${functionName} function.`, { cause: error });
  wrapped.name = ERROR_NAMES.DATABASE_OPERATION;
  console.error(`[${functionName}] ${operation} failed:`, error);
  return wrapped;
}

export function isTransactionConflict(error) {
  const code = error?.code || error?.cause?.code;
  const message = String(error?.message || '').toLowerCase();
  return code === PRISMA_TRANSACTION_CONFLICT_CODE || TRANSACTION_CONFLICT_MESSAGES.some((fragment) => message.includes(fragment));
}
