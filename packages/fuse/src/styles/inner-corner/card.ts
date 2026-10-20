import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Card and the parts built on it. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Card root: `rounded-lg` behind a 1px border. It hands its direct `Card.Section` children the
 * corner they round with, its own less the border, as the private `--card-section-corner`. Every
 * section resets the property at lower specificity, so only a card's direct section holds a value,
 * as Frame does with `--frame-corner`.
 */
export const cardShellClass = cn(
  "rounded-lg border [--shell-inner:max(0px,--theme(--radius-lg)-1px)] *:data-[slot=card-section]:[--card-section-corner:max(0px,--theme(--radius-lg)-1px)]",
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

/**
 * A stacked `Card.Section`: it pads every side with the card's tier, `--card-pad`, and publishes
 * the same inner corner as the other sections. A 1px `--card-section-divider` line runs above every
 * section but the first. The first and last sections round their outer corners with the corner the
 * card hands them, so a fill or a hover fill follows the card's corners. Both skip `hidden`
 * siblings, and middle sections stay square. Outside a card the section is square.
 */
export const cardStackedSectionShellClass = cn(
  "border-0 border-t border-card-section-divider p-[var(--card-pad,var(--surface-pad-md))] [--card-section-corner:initial] [&:nth-child(1_of_:not([hidden]))]:rounded-t-[var(--card-section-corner,0px)] [&:nth-child(1_of_:not([hidden]))]:border-t-0 [&:nth-last-child(1_of_:not([hidden]))]:rounded-b-[var(--card-section-corner,0px)]",
  // Without preflight a section's own `block` or `grid` beats the user-agent `[hidden]` rule.
  "[&[hidden]:not([hidden=until-found])]:hidden",
  cardTierBoundaryClass
);
