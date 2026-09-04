import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * GridList's own dictionary: it owns the `gridList.drag` row of
 * accessibility.md §4.1 — the drag handle's default accessible name.
 */
export const gridListStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
