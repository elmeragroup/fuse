import type { Variables } from "@internationalized/string";

/** Default localized copy for combobox.empty / combobox.clear / combobox.removeItem / combobox.toggle. */
export const svSE = {
  empty: "Inga resultat.",
  clear: "Rensa val",
  toggle: "Visa eller dölj alternativ",
  removeItem: (vars: Variables) => {
    const item = String(vars?.item ?? "").trim();
    return item === "" ? "Ta bort" : `Ta bort ${item}`;
  },
};
