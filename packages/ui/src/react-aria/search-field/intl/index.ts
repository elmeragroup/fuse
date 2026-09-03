import { createStringDictionary } from "../../../hooks/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * SearchField's own dictionary: it owns the `searchField.clear` row of
 * accessibility.md §4.1 — the clear button's default accessible name.
 */
export const searchFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
