/**
 * PUBLIC recipe (text.md §4). Span and other package modules borrow it from
 * `@elmeragroup/ui/text`. `size` is a type-scale axis, not a density control-box
 * rung (conventions.md §Density metrics): it does not read `--control-*`.
 *
 * `destructive` keeps its ref value name for consumer compat, but the class is
 * `text-error` (text.md §8.5). `weight: "bold"` maps to `font-medium` — a
 * deliberate cap on body-copy weight, kept from the ref.
 */
import { tv } from "tailwind-variants";

import { typographyAlignClasses, typographyColorClasses } from "../../styles/typography-fragments";

export const textVariants = tv({
  base: "font-sans",
  variants: {
    variant: {
      ...typographyColorClasses,
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
      ...typographyAlignClasses,
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
