import type { Variables } from "@internationalized/string";

/** Default localized copy for the `dataTable.*` rows. */
export const enUS = {
  noResults: "No results.",
  rowsPerPage: "Rows per page",
  pageOf: (vars: Variables) => `Page ${String(vars?.page)} of ${String(vars?.pageCount)}`,
  page: (vars: Variables) => `Page ${String(vars?.page)}`,
  goToFirstPage: "Go to first page",
  goToPreviousPage: "Go to previous page",
  goToNextPage: "Go to next page",
  goToLastPage: "Go to last page",
  columns: "Columns",
  selectAllOnPage: "Select all rows on this page",
  actions: "Actions",
  actionsFor: (vars: Variables) => `Actions for ${String(vars?.name)}`,
};
