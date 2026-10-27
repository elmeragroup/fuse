import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Autocomplete's own dictionary: it owns the `autocomplete.*` keys. */
export const autocompleteStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
