/**
 * Module-private recipe (link.md §4). Nothing re-exports it: the interim tier has no
 * public recipe surface, and this atom retires with its entry.
 *
 * Colocated instead of living in `src/styles/` because Link is a bare typography atom
 * with a single consumer — the same `<name>-variants.ts` shape Text and Span use — so
 * the whole quarantined module deletes as one directory. The slotted recipes that do
 * sit in `src/styles/` (range-calendar, date-picker) are shared across entries.
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

export const linkVariants = tv({
  base: "font-sans transition-opacity hover:opacity-80",
  variants: {
    variant: {
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      secondary: "text-secondary",
      brand: "text-brand",
      muted: "text-muted-foreground",
      inherit: "text-inherit",
      error: "text-error",
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
      left: "text-left",
      center: "text-center",
      right: "text-right",
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
