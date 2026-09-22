import type { Variables } from "@internationalized/string";

/** Default localized copy for combobox.empty / combobox.clear / combobox.removeItem / combobox.toggle. */
export const enUS = {
  empty: "No results.",
  clear: "Clear selection",
  toggle: "Toggle options",
  removeItem: (vars: Variables) => {
    const item = String(vars?.item ?? "").trim();
    return item === "" ? "Remove" : `Remove ${item}`;
  },
};
