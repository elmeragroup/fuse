import type { Variables } from "@internationalized/string";

import { countOf } from "../../../intl/count-of";

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const fiFI = {
  label: "Joukkotoiminnot",
  // A numeral above one takes the partitive: "1 valittu", "3 valittua".
  selected: (vars: Variables) => countOf("fi-FI", Number(vars?.count), { one: "valittu", other: "valittua" }),
  clear: "Tyhjennä valinta",
};
