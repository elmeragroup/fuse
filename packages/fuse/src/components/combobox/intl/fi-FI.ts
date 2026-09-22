import type { Variables } from "@internationalized/string";

/** Default localized copy for combobox.empty / combobox.clear / combobox.removeItem / combobox.toggle. */
export const fiFI = {
  empty: "Ei tuloksia.",
  clear: "Tyhjennä valinta",
  toggle: "Näytä tai piilota vaihtoehdot",
  removeItem: (vars: Variables) => {
    const item = String(vars?.item ?? "").trim();
    return item === "" ? "Poista" : `Poista ${item}`;
  },
};
