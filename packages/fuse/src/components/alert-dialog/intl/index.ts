import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** AlertDialog's own dictionary: it owns the `alertDialog.cancel` key. */
export const alertDialogStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
