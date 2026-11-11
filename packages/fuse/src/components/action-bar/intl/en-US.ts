import type { Variables } from "@internationalized/string";

import { countOf } from "../../../intl/count-of";

/** Default localized copy for the `actionBar.*` rows: the bar's name, the count and Clear's name. */
export const enUS = {
  label: "Bulk actions",
  selected: (vars: Variables) =>
    countOf("en-US", Number(vars?.count), { one: "selected", other: "selected" }),
  clear: "Clear selection",
};
