import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Calendar's own dictionary, shared by every calendar Root: it owns the `calendar.*` keys. */
export const calendarStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
