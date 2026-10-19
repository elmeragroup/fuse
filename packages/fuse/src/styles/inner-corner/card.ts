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
 * A default Card's tier, published on the root as the private `--card-pad`: the large surface
 * tier, `--surface-pad-lg`, for content surfaces. Every root sets it, so a nested card resets it.
 */
export const cardDefaultTierClass = cn("[--card-pad:var(--surface-pad-lg)]");

/**
 * A small Card's tier: the medium surface tier, `--surface-pad-md`, for cards that hold rows.
 */
export const cardSmallTierClass = cn("[--card-pad:var(--surface-pad-md)]");

/**
 * The boundary every padded part inside a Card's border publishes: the card's `rounded-lg` less
 * its 1px border and the card's tier, `--card-pad`, its inline padding.
 */
const cardTierBoundaryClass = cn(
  "[--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--card-pad))]",
  publishShellBoundary
);

/**
 * A horizontal Card root, which pads its sections itself with the card's tier, `--card-pad`.
 */
export const cardHorizontalShellClass = cn("p-(--card-pad)", cardTierBoundaryClass);

/**
 * A vertical Card's header, content or footer, which pads with the card's tier, `--card-pad`,
 * inside the card.
 */
export const cardSectionShellClass = cn("p-(--card-pad)", cardTierBoundaryClass);

/**
 * The TextField `card` box: a default Card root that pads inline with its tier, the large surface
 * tier, and 16px on the block axis.
 */
export const textFieldCardShellClass = cn("px-(--card-pad) py-4", cardTierBoundaryClass);

/**
 * The CheckboxCard content: a default Card's section that pads inline with its tier, the large
 * surface tier, and 12px on the block axis.
 */
export const checkboxCardContentShellClass = cn("px-(--card-pad) py-3", cardTierBoundaryClass);
