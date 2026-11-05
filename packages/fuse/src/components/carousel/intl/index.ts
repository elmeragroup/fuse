import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Carousel's own dictionary: it owns the `carousel.*` keys. */
export const carouselStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
