import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** DateField's own dictionary: it owns the `dateField.*` keys. */
export const dateFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
