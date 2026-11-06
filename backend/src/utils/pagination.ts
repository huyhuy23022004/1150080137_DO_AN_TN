export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export function resolvePagination(
  pageValue: unknown,
  limitValue: unknown,
  defaultLimit = 20,
  maxLimit = 100,
): Pagination {
  const parsedPage = Number(pageValue);
  const parsedLimit = Number(limitValue);

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit =
    Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  const limit = Math.min(Math.max(requestedLimit, 1), maxLimit);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function buildPaginationMeta(total: number, pagination: Pagination): PaginationMeta {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    total_pages: Math.ceil(total / pagination.limit),
  };
}
