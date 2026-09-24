/**
 * Package-private Link recipe in the shared location used by the interim React Aria tier.
 * `default` and `inherit` both resolve to `text-inherit`; `bold` resolves to `font-medium`.
 * Link's status axis uses `error`, and its live focus state composes the shared focus
 * recipe at render time. This text component has no control-box density metrics.
 */
import { tv } from "tailwind-variants";

import { typographyFragments } from "./typography-fragments";

/**
 * Heading and Text's colour map minus the one key Link does not carry, plus that key's
 * class under Link's own `error` name, so
 * the *value* is shared with Heading's `destructive` arm while the *key* stays Link's —
 * `extend: typographyFragments` would merge every arm and widen `LinkProps["variant"]`
 * with a ninth `destructive` value nobody asked for. Read `variants.variant` instead.
 */
const { destructive: errorColorClass, ...linkColorClasses } = typographyFragments.variants.variant;

export const linkVariants = tv({
  base: "font-sans transition-opacity enabled-hover:opacity-80",
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
