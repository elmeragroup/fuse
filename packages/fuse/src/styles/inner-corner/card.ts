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
 * The boundary every large-tier part inside a Card's border publishes: the card's `rounded-lg`
 * less its 1px border and the large surface tier, `--surface-pad-lg`, its inline padding.
 */
const cardLargeTierBoundaryClass = cn(
  "[--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--surface-pad-lg))]",
  publishShellBoundary
);

/**
 * A horizontal Card root, which pads its sections itself with the large surface tier,
 * `--surface-pad-lg`: 16px dense, 24px comfortable.
 */
export const cardHorizontalShellClass = cn("p-(--surface-pad-lg)", cardLargeTierBoundaryClass);

/**
 * A vertical Card's header, content or footer, which pads with the large surface tier,
 * `--surface-pad-lg`, inside the card.
 */
export const cardSectionShellClass = cn("p-(--surface-pad-lg)", cardLargeTierBoundaryClass);

/**
 * The TextField `card` box: a Card root that pads inline with the large surface tier and 16px
 * on the block axis.
 */
export const textFieldCardShellClass = cn("px-(--surface-pad-lg) py-4", cardLargeTierBoundaryClass);

/**
 * The CheckboxCard content: a Card section that pads inline with the large surface tier and
 * 12px on the block axis.
 */
export const checkboxCardContentShellClass = cn("px-(--surface-pad-lg) py-3", cardLargeTierBoundaryClass);
