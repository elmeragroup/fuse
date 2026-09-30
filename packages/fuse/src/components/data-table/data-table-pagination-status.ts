/**
 * How many pages a paginated table has. A server that counts its rows reports a known page count.
 * A cursor or keyset API only reports whether another page exists.
 */
export type PaginationTotal =
  | {
      /** The server reports the page count. */
      readonly kind: "known";
      /** Total pages. Zero, negative and non-finite counts read as one empty page. */
      readonly pageCount: number;
    }
  | {
      /** The server reports only whether another page follows. */
      readonly kind: "unknown";
      /** Whether a page follows the current one. */
      readonly hasMore: boolean;
    };

/** What the pagination controls show and allow for one page of a total. */
export type PageStatus =
  | {
      readonly kind: "known";
      /** One-based current page. */
      readonly page: number;
      /** Total pages, at least one. */
      readonly pageCount: number;
      readonly canPrevious: boolean;
      readonly canNext: boolean;
    }
  | {
      readonly kind: "unknown";
      /** One-based current page. */
      readonly page: number;
      readonly canPrevious: boolean;
      readonly canNext: boolean;
    };

function knownPageCount(pageCount: number): number {
  return Number.isFinite(pageCount) && pageCount > 1 ? Math.floor(pageCount) : 1;
}

/**
 * Resolve the controls for a page. The total is the only source of Next and Last: TanStack's
 * `getCanNextPage()` reads the `-1` unknown-count sentinel as "always another page".
 *
 * @param pageIndex - The zero-based current page index.
 * @param total - The known page count or the unknown total's `hasMore`.
 * @returns The one-based page, the page count when known, and which moves are available. Last is
 * available exactly when the total is known and Next is.
 */
export function pageStatus(pageIndex: number, total: PaginationTotal): PageStatus {
  const index = Number.isFinite(pageIndex) && pageIndex > 0 ? Math.floor(pageIndex) : 0;
  if (total.kind === "unknown") {
    return { kind: "unknown", page: index + 1, canPrevious: index > 0, canNext: total.hasMore };
  }
  const pageCount = knownPageCount(total.pageCount);
  return {
    kind: "known",
    page: index + 1,
    pageCount,
    canPrevious: index > 0,
    canNext: index < pageCount - 1,
  };
}

/** Skeleton rows never exceed this, whatever the page size. */
const MAX_SKELETON_ROWS = 10;

/** Skeleton rows for a table without pagination. */
const DEFAULT_SKELETON_ROWS = 5;

/**
 * The number of skeleton rows a loading table shows.
 *
 * @param pageSize - The table's page size, or `undefined` without `rowPaginationFeature`.
 * @returns The page size clamped to one through ten, or five without a page size.
 */
export function skeletonRowCount(pageSize: number | undefined): number {
  if (pageSize === undefined || Number.isNaN(pageSize)) {
    return DEFAULT_SKELETON_ROWS;
  }
  return Math.min(MAX_SKELETON_ROWS, Math.max(1, Math.floor(pageSize)));
}
