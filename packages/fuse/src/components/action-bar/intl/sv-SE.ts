import type { Variables } from "@internationalized/string";

const numbers = new Intl.NumberFormat("sv-SE");
const plurals = new Intl.PluralRules("sv-SE");

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const svSE = {
  label: "Massåtgärder",
  selected: (vars: Variables) => {
    const count = Number(vars?.count);
    return `${numbers.format(count)} ${plurals.select(count) === "one" ? "markerad" : "markerade"}`;
  },
  clear: "Rensa markering",
};
