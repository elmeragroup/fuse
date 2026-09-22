import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** NumberField's own dictionary: it owns the `numberField.*` keys. */
export const numberFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
