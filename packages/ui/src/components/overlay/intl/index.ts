import { createStringDictionary } from "../../../intl/create-string-dictionary";
import { enUS } from "./en-US";
import { fiFI } from "./fi-FI";
import { nbNO } from "./nb-NO";
import { svSE } from "./sv-SE";

/**
 * The overlay families' shared `close` dictionary (accessibility.md §4.1, amended
 * 2026-09-03 — pending owner confirmation; ADR 0006 amendment 2026-09-03).
 *
 * Four modules resolve this one row because the accessible name of an overlay's
 * dismiss control is the same word in all four locales wherever it appears: the
 * shared `OverlayCloseButton` (Dialog.Content's and Sheet's corner affordance, and
 * Sidebar's mobile header row), `dialog.tsx`'s footer action (where the label is
 * also visible text), `toast.tsx`, and the package-private
 * `react-aria/internal/dialog.tsx`. The
 * RAC picker dialog paints its own `dialogVariants().closeButton` and still shares
 * the copy — a family-owned row shares the string, not the markup. Every reader's
 * `closeLabel` (Toast: `label`) prop still overrides it at the call site.
 *
 * Spec 08 names this module `overlay/intl/close`; it ships as the `intl/index.ts`
 * dictionary module that accessibility.md §4 mandates for every string owner.
 */
export const overlayCloseStrings = createStringDictionary({ enUS, fiFI, nbNO, svSE });
