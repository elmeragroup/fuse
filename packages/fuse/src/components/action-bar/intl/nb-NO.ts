import type { Variables } from "@internationalized/string";

import { countOf } from "../../../intl/count-of";

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const nbNO = {
  label: "Massehandlinger",
  selected: (vars: Variables) => countOf("nb-NO", Number(vars?.count), { one: "valgt", other: "valgt" }),
  clear: "Fjern valg",
};
