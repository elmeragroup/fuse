import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Slider's own dictionary: it owns the `slider.*` keys. */
export const sliderStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
