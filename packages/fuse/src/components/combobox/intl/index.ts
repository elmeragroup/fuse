import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Combobox's own dictionary: it owns the `combobox.*` keys. */
export const comboboxStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
