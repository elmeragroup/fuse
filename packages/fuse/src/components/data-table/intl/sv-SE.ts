import type { Variables } from "@internationalized/string";

/** Default localized copy for the `dataTable.*` rows. */
export const svSE = {
  noResults: "Inga resultat.",
  rowsPerPage: "Rader per sida",
  pageOf: (vars: Variables) => `Sida ${String(vars?.page)} av ${String(vars?.pageCount)}`,
  page: (vars: Variables) => `Sida ${String(vars?.page)}`,
  goToFirstPage: "Gå till första sidan",
  goToPreviousPage: "Gå till föregående sida",
  goToNextPage: "Gå till nästa sida",
  goToLastPage: "Gå till sista sidan",
  columns: "Kolumner",
  selectAllOnPage: "Markera alla rader på den här sidan",
  actions: "Åtgärder",
  actionsFor: (vars: Variables) => `Åtgärder för ${String(vars?.name)}`,
};
