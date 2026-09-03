import { createStringDictionary } from "../../../hooks/create-string-dictionary";

import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * The overlay families' shared `close` dictionary: Dialog, Sheet, and Toast render the
 * same corner dismiss affordance (`overlayCornerCloseButton`) and the same four-locale
 * copy, so accessibility.md §4.1 assigns the row to the overlay family rather than to
 * each component (accessibility.md §4.1, amended 2026-09-03 — pending owner
 * confirmation). Each component's `closeLabel` prop still overrides it at the call site.
 */
export const overlayCloseStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
