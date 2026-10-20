import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Loader's own dictionary: it owns the `loader.*` keys. */
export const loaderStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
