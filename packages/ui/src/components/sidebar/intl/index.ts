import { createStringDictionary } from "../../../hooks/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Sidebar's own dictionary: it owns the `sidebar.*` rows of accessibility.md §4.1. */
export const sidebarStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
