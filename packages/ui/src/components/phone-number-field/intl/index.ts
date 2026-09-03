import { createStringDictionary } from "../../../hooks/create-string-dictionary";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** PhoneNumberField's own dictionary: it owns the `phoneNumberField.*` rows of accessibility.md §4.1. */
export const phoneNumberFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
