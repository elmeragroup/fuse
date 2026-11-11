import type { Variables } from "@internationalized/string";

import { countOf } from "../../../intl/count-of";

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const svSE = {
  label: "Massåtgärder",
  selected: (vars: Variables) =>
    countOf("sv-SE", Number(vars?.count), { one: "markerad", other: "markerade" }),
  clear: "Rensa markering",
};
