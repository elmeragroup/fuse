import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** DataTable's own dictionary: it owns the `dataTable.*` keys. */
export const dataTableStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
