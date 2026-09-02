import { LocalizedStringDictionary } from "@internationalized/string";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * GridList's own dictionary: it owns the `gridList.drag` row of
 * accessibility.md §4.1 — the drag handle's default accessible name.
 */
export const gridListStrings = new LocalizedStringDictionary({
  "en-US": enUS,
  "fi-FI": fiFI,
  "nb-NO": nbNO,
  "sv-SE": svSE,
});
