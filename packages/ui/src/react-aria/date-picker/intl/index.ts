import { LocalizedStringDictionary } from "@internationalized/string";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * DatePicker's own dictionary: it owns the `datePicker.presets` row of
 * accessibility.md §4.1 — the preset group's default accessible name. Preset item copy
 * is consumer-visible content and is never translated here (§4.1 closing rule).
 */
export const datePickerStrings = new LocalizedStringDictionary({
  "en-US": enUS,
  "fi-FI": fiFI,
  "nb-NO": nbNO,
  "sv-SE": svSE,
});
