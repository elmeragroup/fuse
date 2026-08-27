import { LocalizedStringDictionary } from "@internationalized/string";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** PopoverInfoButton's own dictionary: it owns `popoverInfoButton.moreInformation`. */
export const popoverInfoButtonStrings = new LocalizedStringDictionary({
  "en-US": enUS,
  "fi-FI": fiFI,
  "nb-NO": nbNO,
  "sv-SE": svSE,
});
