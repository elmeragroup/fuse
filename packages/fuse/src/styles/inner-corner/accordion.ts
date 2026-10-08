import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Accordion items. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.
// Every item pads with the medium surface tier, `--surface-pad-md`: 12px dense, 16px comfortable.

/**
 * A default Accordion item: `rounded-sm` and the medium surface padding.
 */
export const accordionItemShellClass = cn(
  "rounded-sm p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-sm)-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * A card Accordion item: `rounded-lg` behind a 1px border and the medium surface padding.
 */
export const accordionCardItemShellClass = cn(
  "rounded-lg border p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * An Accordion item with the `lg` radius, unbordered, with the medium surface padding.
 */
export const accordionItemLgShellClass = cn(
  "rounded-lg p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * An Accordion item with the `xl` radius, unbordered, with the medium surface padding.
 */
export const accordionItemXlShellClass = cn(
  "rounded-xl p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * A card Accordion item with the `lg` radius.
 */
export const accordionCardItemLgShellClass = cn(
  "rounded-lg border p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * A card Accordion item with the `xl` radius.
 */
export const accordionCardItemXlShellClass = cn(
  "rounded-xl border p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-xl)-1px-var(--surface-pad-md))]",
  publishShellBoundary
);
