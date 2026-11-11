import type { Variables } from "@internationalized/string";

const numbers = new Intl.NumberFormat("en-US");

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const enUS = {
  label: "Bulk actions",
  selected: (vars: Variables) => `${numbers.format(Number(vars?.count))} selected`,
  clear: "Clear selection",
};
