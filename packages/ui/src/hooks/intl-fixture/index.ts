import { LocalizedStringDictionary } from "@internationalized/string";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/** Fixture dictionary for the locale-matrix helper. Not a public component dictionary. */
export const fixtureDictionary = new LocalizedStringDictionary({
  "en-US": enUS,
  "fi-FI": fiFI,
  "nb-NO": nbNO,
  "sv-SE": svSE,
});
