/**
 * PUBLIC recipe. Other package modules import this file relatively;
 * consumers borrow it from `@elmeragroup/ui/heading`.
 *
 * Colour (`variant`) and start/center/end (`align`) come from the package-private
 * `typographyFragments` recipe via `extend`. Size, font, noMargin, and uppercase
 * stay here.
 *
 * - `destructive` keeps its ref value name for consumer compat, but the class is
 *   `text-error` — no `destructive` class appears in library source.
 * - `size` is a type-scale axis, not a density control-box rung: it does not read `--control-*`.
 */
import { tv } from "tailwind-variants";

import { typographyFragments } from "../../styles/typography-fragments";

export const headingVariants = tv({
  extend: typographyFragments,
  base: "font-heading text-foreground",
  variants: {
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
    noMargin: {
      true: "mb-0",
    },
    uppercase: {
      true: "uppercase",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    font: "default",
  },
});
