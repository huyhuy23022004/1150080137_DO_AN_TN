interface MySqlErrorLike {
  code?: unknown;
  errno?: unknown;
  sqlMessage?: unknown;
  message?: unknown;
}

function asMySqlError(error: unknown): MySqlErrorLike | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  return error as MySqlErrorLike;
}

export function getMySqlErrorCode(error: unknown): string | null {
  const candidate = asMySqlError(error);
  return typeof candidate?.code === 'string' ? candidate.code : null;
}

export function isDuplicateEntryError(error: unknown): boolean {
  return getMySqlErrorCode(error) === 'ER_DUP_ENTRY';
}

export function isRetryableTransactionError(error: unknown): boolean {
  const code = getMySqlErrorCode(error);
  return code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT';
}

export function getDuplicateField(error: unknown): string | null {
  const candidate = asMySqlError(error);
  const message =
    typeof candidate?.sqlMessage === 'string'
      ? candidate.sqlMessage
      : typeof candidate?.message === 'string'
        ? candidate.message
        : '';

  if (message.includes('so_dien_thoai')) {
    return 'so_dien_thoai';
  }

  if (message.includes('email')) {
    return 'email';
  }

  return null;
}
