import { cn } from "../../styles/cn";
import {
  cardDefaultTierClass,
  cardHorizontalShellClass,
  cardLargeTierClass,
  cardSectionShellClass,
  cardShellClass,
  cardStackedSectionShellClass,
} from "../../styles/inner-corner/card";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { insetFocusRingClass } from "../../styles/utils";

/**
 * PUBLIC slot recipe. `text-field`'s `card` variant and
 * `CheckboxCard` compose it, so it ships from `@elmeragroup/fuse/card`.
 * The base draws its edge in `--card-border`, which external themes make transparent; both
 * composers pin `border-border` over it, since a field box and a control keep a visible edge.
 * Horizontal cards keep their header text in a grid and wrap whole sections when
 * the container cannot fit them side by side.
 * The external ref's surface/padding axes are decomposed away into `direction` and `size`.
 * `size` sets the card's surface tier on the base as `--card-pad`: the medium tier,
 * `--surface-pad-md`, by default and the large tier, `--surface-pad-lg`, at `lg`. Sections pad
 * with it, and a content or footer below another section drops its top padding, so the tier is
 * also the gap between sections. A content or footer that opens the card keeps it. A horizontal
 * card pads and gaps its sections with the same tier.
 * The title is `leading-snug` in both directions, as `Heading` and `Item.Title` are, so a title
 * that wraps keeps space between its lines.
 */
export const cardVariants = tv({
  slots: {
    base: [cardShellClass, "shadow-xs flex flex-col border-card-border bg-card text-card-foreground"],
    cardHeader:
      "@container/card-header grid auto-rows-min items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
    cardTag: "text-sm font-semibold text-muted-foreground",
    cardTitle: "font-semibold leading-snug",
    cardDescription: "text-muted-foreground",
    cardAction: "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
    cardContent: "",
    cardFooter: "flex items-center",
    // Fuse ships no preflight, so the section resets a native button's face, font and alignment
    // itself. A button or link section takes Item's anchor hover fill, a pointer cursor and an
    // inset focus ring, which the sections around it cannot paint over.
    cardSection: cn(
      cardStackedSectionShellClass,
      "box-border block w-full bg-transparent text-start text-inherit transition-colors duration-100 [font:inherit]",
      "has-[>[data-slot=card-section-media]]:grid has-[>[data-slot=card-section-media]]:grid-cols-[auto_minmax(0,1fr)] has-[>[data-slot=card-section-media]]:items-center has-[>[data-slot=card-section-media]]:gap-x-(--surface-gap-md)",
      "[&:is(a,button)]:cursor-pointer [&:is(a,button)]:enabled-hover:bg-muted",
      insetFocusRingClass,
      nativeStateFaceClass
    ),
    cardSectionMedia: "flex shrink-0 items-center justify-center [&>svg]:size-5",
  },
  variants: {
    direction: {
      vertical: {
        cardHeader: cardSectionShellClass,
        cardContent: [cardSectionShellClass, "not-first:pt-0"],
        cardFooter: [cardSectionShellClass, "not-first:pt-0"],
      },
      horizontal: {
        base: [
          cardHorizontalShellClass,
          "flex-row flex-wrap items-start gap-[var(--card-pad,var(--surface-pad-md))]",
        ],
        cardHeader: "min-w-0 flex-[2_1_16rem] wrap-anywhere",
        cardContent: "min-w-0 flex-[1_1_12rem] wrap-anywhere",
        cardFooter: "min-w-0 flex-[1_1_8rem] wrap-anywhere",
        cardTitle: "text-xl/snug",
      },
    },
    size: {
      default: { base: cardDefaultTierClass },
      lg: { base: cardLargeTierClass },
    },
  },
  defaultVariants: {
    direction: "vertical",
    size: "default",
  },
});

/**
 * Module-private type-scale recipes for `Card.Title` / `Card.Description`.
 * Not exported from `@elmeragroup/fuse/card` — there is no borrow
 * pattern. Kept off `cardVariants` because `direction="horizontal"` already
 * sets `cardTitle: "text-xl/snug"`; a second `size` axis on that slot would fight
 * through twMerge. `size` is a type-scale axis, not a density control-box rung:
 * it does not read `--control-*`.
 */
export const cardTitleVariants = tv({
  variants: {
    size: {
      default: "text-base",
      sm: "text-sm",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-4xl",
      "5xl": "text-5xl",
      "6xl": "text-6xl",
    },
  },
  defaultVariants: {
    size: "2xl",
  },
});

export const cardDescriptionVariants = tv({
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      default: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});
