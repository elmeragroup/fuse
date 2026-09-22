import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Sidebar's own dictionary: it owns the `sidebar.*` keys. */
export const sidebarStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
