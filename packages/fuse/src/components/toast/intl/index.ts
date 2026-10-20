import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * Toast's own dictionary: it owns the `toast.*` keys. The close label stays on the shared
 * overlay dictionary.
 */
export const toastStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
