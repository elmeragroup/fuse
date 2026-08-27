import type { Variables } from "@internationalized/string";

/** accessibility.md §4.1 — locked copy for combobox.empty / combobox.clear / combobox.removeItem. */
export const nbNO = {
  empty: "Ingen resultater.",
  clear: "Tøm valg",
  removeItem: (vars: Variables) => `Fjern ${String(vars?.item ?? "")}`,
};
