import type { Variables } from "@internationalized/string";

/** accessibility.md §4.1 — locked copy for combobox.empty / combobox.clear / combobox.removeItem. */
export const svSE = {
  empty: "Inga resultat.",
  clear: "Rensa val",
  removeItem: (vars: Variables) => `Ta bort ${String(vars?.item ?? "")}`,
};
