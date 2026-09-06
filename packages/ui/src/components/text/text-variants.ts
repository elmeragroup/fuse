/**
 * PUBLIC recipe. Span and other package modules borrow it from
 * `@elmeragroup/ui/text`. `size` is a type-scale axis, not a density control-box
 * rung: it does not read `--control-*`.
 *
 * Colour (`variant`) and start/center/end (`align`) come from the package-private
 * `typographyFragments` recipe via `extend`. This recipe adds `success` and
 * `justify`. `destructive` keeps its ref value name for consumer compat, but the
 * class is `text-error`. `weight: "bold"` maps to `font-medium` — a
 * deliberate cap on body-copy weight, kept from the ref.
 */
import { tv } from "tailwind-variants";

import { typographyFragments } from "../../styles/typography-fragments";

export const textVariants = tv({
  extend: typographyFragments,
  base: "font-sans",
  variants: {
    variant: {
      success: "text-success",
    },
    size: {
      xs: "text-xs *:text-xs **:text-xs",
      sm: "text-sm *:text-sm **:text-sm",
      default: "text-base *:text-base **:text-base",
      lg: "text-lg *:text-lg **:text-lg",
      xl: "text-xl *:text-xl **:text-xl",
      "2xl": "text-2xl *:text-2xl **:text-2xl",
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
      justify: "text-justify",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      bold: "font-medium",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    leading: "relaxed",
    weight: "normal",
  },
});
