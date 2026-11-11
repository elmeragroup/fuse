import type { Variables } from "@internationalized/string";

const numbers = new Intl.NumberFormat("nb-NO");

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const nbNO = {
  label: "Massehandlinger",
  selected: (vars: Variables) => `${numbers.format(Number(vars?.count))} valgt`,
  clear: "Fjern valg",
};
