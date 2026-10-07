import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Card and the parts built on it. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Card root: `rounded-lg` behind a 1px border.
 */
export const cardShellClass = cn(
  "rounded-lg border [--shell-inner:max(0px,--theme(--radius-lg)-1px)]",
  publishShellBoundary
);

/**
 * A horizontal Card root, which pads its sections itself.
 */
export const cardHorizontalShellClass = cn(
  "p-6 [--shell-inner:max(0px,--theme(--radius-lg)-1px-6*var(--spacing))]",
  publishShellBoundary
);

/**
 * A vertical Card's header, content or footer, which pads 24px inside the card.
 */
export const cardSectionShellClass = cn(
  "p-6 [--shell-inner:max(0px,--theme(--radius-lg)-1px-6*var(--spacing))]",
  publishShellBoundary
);

/**
 * The TextField `card` box: a Card root that pads 24px inline.
 */
export const textFieldCardShellClass = cn(
  "px-6 py-4 [--shell-inner:max(0px,--theme(--radius-lg)-1px-6*var(--spacing))]",
  publishShellBoundary
);

/**
 * The CheckboxCard content: a Card section that pads 16px inline.
 */
export const checkboxCardContentShellClass = cn(
  "px-4 py-3 [--shell-inner:max(0px,--theme(--radius-lg)-1px-4*var(--spacing))]",
  publishShellBoundary
);
