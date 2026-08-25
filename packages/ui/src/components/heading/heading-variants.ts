/**
 * PUBLIC recipe (heading.md §4). Other package modules import this file relatively;
 * consumers borrow it from `@elmeragroup/ui/heading`.
 *
 * - `destructive` keeps its ref value name for consumer compat, but the class is
 *   `text-error` (heading.md §8.4) — no `destructive` class appears in library source.
 * - `size` is a type-scale axis, not a density control-box rung (conventions.md
 *   §Density metrics): it does not read `--control-*`.
 * - `prose: true` maps to an empty class string — a reserved hook kept from the ref.
 */
import { tv } from "tailwind-variants";

import { typographyAlignClasses, typographyColorClasses } from "../../styles/typography-fragments";

export const headingVariants = tv({
  base: "font-heading text-foreground",
  variants: {
    variant: typographyColorClasses,
    size: {
      default: "text-base leading-snug",
      sm: "text-sm leading-snug",
      lg: "text-lg leading-snug",
      xl: "text-xl leading-snug",
      "2xl": "text-2xl leading-snug",
      "3xl": "text-3xl leading-snug",
      "4xl": "text-4xl leading-snug",
      "5xl": "text-5xl leading-snug",
      "6xl": "text-6xl leading-tight",
    },
    font: {
      default: "font-medium",
      normal: "font-normal",
      "semi-bold": "font-semibold",
    },
    prose: {
      true: "",
    },
    noMargin: {
      true: "mb-0",
    },
    uppercase: {
      true: "uppercase",
    },
    align: typographyAlignClasses,
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    font: "default",
  },
});
