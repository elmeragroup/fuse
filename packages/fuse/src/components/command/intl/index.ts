import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Command's own dictionary: it owns the `command.*` keys. */
export const commandStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
