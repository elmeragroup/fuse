import type { Variables } from "@internationalized/string";

/** Default localized copy for the `dataTable.*` rows. */
export const nbNO = {
  noResults: "Ingen resultater.",
  rowsPerPage: "Rader per side",
  pageOf: (vars: Variables) => `Side ${String(vars?.page)} av ${String(vars?.pageCount)}`,
  page: (vars: Variables) => `Side ${String(vars?.page)}`,
  goToFirstPage: "Gå til første side",
  goToPreviousPage: "Gå til forrige side",
  goToNextPage: "Gå til neste side",
  goToLastPage: "Gå til siste side",
  columns: "Kolonner",
  selectAllOnPage: "Velg alle rader på denne siden",
};
