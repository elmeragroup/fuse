import type { Variables } from "@internationalized/string";

const numbers = new Intl.NumberFormat("fi-FI");
const plurals = new Intl.PluralRules("fi-FI");

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const fiFI = {
  label: "Joukkotoiminnot",
  // A numeral above one takes the partitive: "1 valittu", "3 valittua".
  selected: (vars: Variables) => {
    const count = Number(vars?.count);
    return `${numbers.format(count)} ${plurals.select(count) === "one" ? "valittu" : "valittua"}`;
  },
  clear: "Tyhjennä valinta",
};
