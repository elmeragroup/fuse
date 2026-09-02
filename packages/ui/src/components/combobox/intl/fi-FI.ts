import type { Variables } from "@internationalized/string";

/** accessibility.md §4.1 — locked copy for combobox.empty / combobox.clear / combobox.removeItem. */
export const fiFI = {
  empty: "Ei tuloksia.",
  clear: "Tyhjennä valinta",
  removeItem: (vars: Variables) => {
    const item = String(vars?.item ?? "").trim();
    return item === "" ? "Poista" : `Poista ${item}`;
  },
};
