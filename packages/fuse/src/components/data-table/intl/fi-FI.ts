import type { Variables } from "@internationalized/string";

/** Default localized copy for the `dataTable.*` rows. */
export const fiFI = {
  noResults: "Ei tuloksia.",
  rowsPerPage: "Rivejä sivulla",
  pageOf: (vars: Variables) => `Sivu ${String(vars?.page)}/${String(vars?.pageCount)}`,
  page: (vars: Variables) => `Sivu ${String(vars?.page)}`,
  goToFirstPage: "Siirry ensimmäiselle sivulle",
  goToPreviousPage: "Siirry edelliselle sivulle",
  goToNextPage: "Siirry seuraavalle sivulle",
  goToLastPage: "Siirry viimeiselle sivulle",
  columns: "Sarakkeet",
  selectAllOnPage: "Valitse kaikki tämän sivun rivit",
  actions: "Toiminnot",
  actionsFor: (vars: Variables) => `Toiminnot: ${String(vars?.name)}`,
};
