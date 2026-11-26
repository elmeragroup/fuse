import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** TimelineList's own dictionary, the hidden status text of `complete`, `upcoming` and `error`. */
export const timelineListStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
