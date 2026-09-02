import type { Variables } from "@internationalized/string";

/** accessibility.md §4.1 — locked copy for combobox.empty / combobox.clear / combobox.removeItem / combobox.toggle. */
export const nbNO = {
  empty: "Ingen resultater.",
  clear: "Tøm valg",
  toggle: "Vis eller skjul alternativer",
  removeItem: (vars: Variables) => {
    const item = String(vars?.item ?? "").trim();
    return item === "" ? "Fjern" : `Fjern ${item}`;
  },
};
