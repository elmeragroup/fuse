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
 * A default Card's tier, published on the root as the private `--card-pad`: the medium surface
 * tier, `--surface-pad-md`, which Items and Accordion items pad with too, so a card's text starts
 * on their edge. Every root sets it, so a nested card resets it.
 */
export const cardDefaultTierClass = cn("[--card-pad:var(--surface-pad-md)]");

/**
 * A large Card's tier: the large surface tier, `--surface-pad-lg`, for a card that holds long
 * prose or acts as a page's main panel.
 */
export const cardLargeTierClass = cn("[--card-pad:var(--surface-pad-lg)]");

/**
 * The boundary every padded part inside a Card's border publishes: the card's `rounded-lg` less
 * its 1px border and the card's tier, `--card-pad`, its inline padding. Each padded part falls
 * back to the default tier outside a card root, so a section recipe used on its own pads as one
 * inside a default card.
 */
const cardTierBoundaryClass = cn(
  "[--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--card-pad,var(--surface-pad-md)))]",
  publishShellBoundary
);

/**
 * A horizontal Card root, which pads its sections itself with the card's tier, `--card-pad`.
 */
export const cardHorizontalShellClass = cn(
  "p-[var(--card-pad,var(--surface-pad-md))]",
  cardTierBoundaryClass
);

/**
 * A vertical Card's header, content or footer, which pads with the card's tier, `--card-pad`,
 * inside the card.
 */
export const cardSectionShellClass = cn("p-[var(--card-pad,var(--surface-pad-md))]", cardTierBoundaryClass);

/**
 * The TextField `card` box: a default Card root that pads inline with its tier and 16px on the
 * block axis.
 */
export const textFieldCardShellClass = cn(
  "px-[var(--card-pad,var(--surface-pad-md))] py-4",
  cardTierBoundaryClass
);

/**
 * The CheckboxCard content: a default Card's section that pads inline with its tier and 12px on the
 * block axis.
 */
export const checkboxCardContentShellClass = cn(
  "px-[var(--card-pad,var(--surface-pad-md))] py-3",
  cardTierBoundaryClass
);
