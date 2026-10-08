import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Accordion items. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * A default Accordion item: `rounded-sm` and 16px padding.
 */
export const accordionItemShellClass = cn(
  "rounded-sm p-4 [--shell-inner:max(0px,--theme(--radius-sm)-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * A card Accordion item: `rounded-lg` behind a 1px border and 16px padding.
 */
export const accordionCardItemShellClass = cn(
  "rounded-lg border p-4 [--shell-inner:max(0px,--theme(--radius-lg)-1px-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * An Accordion item with the `lg` radius, unbordered, padded 16px.
 */
export const accordionItemLgShellClass = cn(
  "rounded-lg p-4 [--shell-inner:max(0px,--theme(--radius-lg)-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * An Accordion item with the `xl` radius, unbordered, padded 16px.
 */
export const accordionItemXlShellClass = cn(
  "rounded-xl p-4 [--shell-inner:max(0px,--theme(--radius-xl)-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * A card Accordion item with the `lg` radius.
 */
export const accordionCardItemLgShellClass = cn(
  "rounded-lg border p-4 [--shell-inner:max(0px,--theme(--radius-lg)-1px-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * A card Accordion item with the `xl` radius.
 */
export const accordionCardItemXlShellClass = cn(
  "rounded-xl border p-4 [--shell-inner:max(0px,--theme(--radius-xl)-1px-4*var(--spacing))]",
  publishShellBoundary
);
