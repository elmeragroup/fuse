import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** ActionBar's own dictionary: it owns the `actionBar.*` keys. */
export const actionBarStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
