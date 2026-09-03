import { createStringDictionary } from "../../../hooks/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Meter's own dictionary: it owns the `meter.warning` / `meter.success` rows of accessibility.md §4.1. */
export const meterStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
