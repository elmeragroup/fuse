import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * The overlay families' shared `close` dictionary.
 *
 * Four modules resolve this one row, because the accessible name of an overlay's dismiss control
 * is the same word wherever it appears, in each of the four locales:
 *
 * - the shared `OverlayCloseButton`, which is the corner close button of `Dialog.Content` and Sheet
 *   and the close button in Sidebar's mobile header row;
 * - the footer action in `dialog.tsx`, where the label is also visible text;
 * - `toast.tsx`;
 * - `Command.CloseHint` in `command.tsx`, where it labels the Escape key.
 *
 * A family-owned row shares the string, not the markup. Each reader's `closeLabel` still overrides
 * it at the call site. Toast's override is `label`, and the override of `Command.CloseHint` is its
 * children.
 */
export const overlayCloseStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
