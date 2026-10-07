import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Combobox: its popup, list and chips. The rules every shell follows are
// in `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Combobox popup. It publishes no corner; its List pads the rows and publishes.
 */
export const listboxPopupShellClass = cn("rounded-md [--shell-inner:initial]", publishShellBoundary);

/**
 * `Combobox.List`: pads its rows 4px inside the popup's `rounded-md` and publishes. An empty List
 * drops its padding, so it publishes the popup's rung at zero inset.
 */
export const listboxListShellClass = cn(
  "p-1 [--shell-inner:max(0px,--theme(--radius-md)-var(--spacing))] data-empty:p-0 data-empty:[--shell-inner:--theme(--radius-md)]",
  publishShellBoundary
);

/**
 * The Combobox chips box: it pads its chips 6px inside the border.
 */
export const chipsShellClass = cn(
  "py-1.5 [--shell-inner:max(0px,var(--field-corner)-1px-1.5*var(--spacing))] has-data-[slot=combobox-chip]:px-1.5",
  publishShellBoundary
);

/**
 * A Combobox chip. It pads its remove button 2px from its end.
 */
export const chipShellClass = cn("rounded-inner has-data-[slot=combobox-chip-remove]:pr-0.5");

/**
 * A chip's remove button, a third level. The chip reads `--inner-corner` and cannot also publish
 * it, so the button subtracts the chip's 2px end padding from the inherited value.
 */
export const chipRemoveShellClass = cn(
  "rounded-[max(0px,var(--inner-corner,var(--radius))-0.5*var(--spacing))]"
);
