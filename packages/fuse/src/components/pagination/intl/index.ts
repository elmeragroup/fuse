import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Pagination's own dictionary: it owns the `pagination.*` keys. */
export const paginationStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
