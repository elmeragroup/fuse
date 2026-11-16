import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * The tour's dictionary: the labels of `Tour.Next`, `Tour.Prev` and `Tour.Skip`, the count
 * `Tour.Progress` shows, and the step it announces. `Tour.Close` takes its name from the overlay
 * families' shared `close` row.
 */
export const tourStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
