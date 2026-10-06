import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * DatePicker's own dictionary: it owns the `datePicker.presets` row of
 * the preset group's default accessible name, which DateRangePicker's preset group
 * shares through `internal/picker-presets`. Preset item copy
 * is consumer-visible content and is never translated here.
 */
export const datePickerStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
