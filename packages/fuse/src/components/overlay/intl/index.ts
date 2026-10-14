import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * The overlay families' shared `close` dictionary.
 *
 * Five modules resolve this one row because the accessible name of an overlay's
 * dismiss control is the same word in all four locales wherever it appears: the
 * shared `OverlayCloseButton` (Dialog.Content's and Sheet's corner affordance, and
 * Sidebar's mobile header row), `dialog.tsx`'s footer action (where the label is
 * also visible text), `toast.tsx`, `command.tsx`'s `Command.CloseHint` (where it
 * labels the Escape key), and the package-private `react-aria/internal/dialog.tsx`.
 * The RAC picker dialog paints its own `dialogVariants().closeButton` and still
 * shares the copy — a family-owned row shares the string, not the markup. Every
 * reader's `closeLabel` (Toast: `label`, `Command.CloseHint`: its children) still
 * overrides it at the call site.
 */
export const overlayCloseStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
