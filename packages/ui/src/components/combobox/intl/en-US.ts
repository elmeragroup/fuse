import type { Variables } from "@internationalized/string";

/** accessibility.md §4.1 — locked copy for combobox.empty / combobox.clear / combobox.removeItem. */
export const enUS = {
  empty: "No results.",
  clear: "Clear selection",
  removeItem: (vars: Variables) => {
    const item = String(vars?.item ?? "").trim();
    return item === "" ? "Remove" : `Remove ${item}`;
  },
};
