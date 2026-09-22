import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** PhoneNumberField's own dictionary: it owns the `phoneNumberField.*` keys. */
export const phoneNumberFieldStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
