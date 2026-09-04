/**
 * Link's recipe (link.md §4). Package-private: nothing re-exports it, the interim tier
 * has no public recipe surface, and this atom retires with its entry.
 *
 * It lives in `src/styles/` because that is where every RAC entry's recipe lives —
 * range-calendar.md §8.2's locked ruling, applied uniformly across the cluster rather
 * than per-entry. Sharing is not the reason: every recipe in this directory has exactly
 * one consumer today. The ruling buys one predictable location, so the whole quarantined
 * tier retires as `react-aria/**` plus its `styles/<slug>.ts` siblings.
 *
 * Two faithful quirks are kept, not fixed (§8.3): `variant="default"` and
 * `variant="inherit"` are duplicates (both `text-inherit`), and `weight="bold"` renders
 * `font-medium`. The ref's status-colour value and class are renamed to `error` /
 * `text-error` (§8.2) — the ref's status vocabulary never appears in library source.
 *
 * The focus ring is deliberately absent here. §4 fixes `base` at three utilities and
 * composes `focusRing({ target: "state", isFocusVisible })` from RAC's render props, so
 * `styles/utils` stays the only module that spells a focus class (accessibility.md §2).
 *
 * No `size` axis and no control-box metrics: a text atom has no control box, so nothing
 * here reads a density implementation variable (conventions.md §Density ladder).
 */
import { tv } from "tailwind-variants";

import { typographyFragments } from "./typography-fragments";

/**
 * Heading and Text's colour map minus the one key Link does not carry, plus that key's
 * class under Link's own name. §8.2 renames the reference's status colour to `error`, so
 * the *value* is shared with Heading's `destructive` arm while the *key* stays Link's —
 * `extend: typographyFragments` would merge every arm and widen `LinkProps["variant"]`
 * with a ninth `destructive` value nobody asked for. Read `variants.variant` instead.
 */
const { destructive: errorColorClass, ...linkColorClasses } = typographyFragments.variants.variant;

export const linkVariants = tv({
  base: "font-sans transition-opacity hover:opacity-80",
  variants: {
    variant: {
      ...linkColorClasses,
      error: errorColorClass,
    },
    leading: {
      none: "leading-none",
      tight: "leading-tight",
      snug: "leading-snug",
      relaxed: "leading-relaxed",
      loose: "leading-loose",
    },
    truncate: {
      true: "truncate",
    },
    align: {
      ...typographyFragments.variants.align,
      justify: "text-justify",
    },
    weight: {
      normal: "font-normal",
      bold: "font-medium",
    },
  },
  defaultVariants: {
    variant: "default",
    weight: "normal",
  },
});
