import { createStringDictionary } from "../../../hooks/create-string-dictionary";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Breadcrumb's own dictionary: it owns the `breadcrumb.*` rows of accessibility.md §4.1. */
export const breadcrumbStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
