import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Meter's own dictionary, which holds the `meter.warning` and `meter.success` keys. */
export const meterStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
