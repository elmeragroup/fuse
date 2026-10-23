/**
 * PUBLIC recipe. Span and other package modules borrow it from
 * `@elmeragroup/fuse/text`. `size` is a type-scale axis, not a density control-box
 * rung: it does not read `--control-*`.
 *
 * Colour (`variant`) and start/center/end (`align`) come from the package-private
 * `typographyFragments` recipe via `extend`. This recipe adds `success` and
 * `justify`. `destructive` keeps its ref value name for consumer compat, but the
 * class is `text-error`. `weight: "bold"` maps to `font-medium` — a
 * deliberate cap on body-copy weight, kept from the ref.
 *
 * Each `size` arm puts the plain `text-<size>` on the Text but sizes children and
 * descendants with the font-size-only `text-(length:--text-<size>)`. A plain
 * `text-<size>` also sets `line-height: var(--tw-leading, …)`, and `--tw-leading`
 * does not inherit, so on a descendant it would replace the Text's `leading` with
 * the size's own line height. The `length:` form leaves line height inherited.
 * A descendant with its own plain `text-<size>` class still takes the Text's font
 * size but keeps that class's own line-height ratio.
 */
import { tv } from "../../styles/tv";
import { typographyFragments } from "../../styles/typography-fragments";

export const textVariants = tv({
  extend: typographyFragments,
  base: "font-sans",
  variants: {
    variant: {
      success: "text-success",
    },
    size: {
      xs: "text-xs *:text-(length:--text-xs) **:text-(length:--text-xs)",
      sm: "text-sm *:text-(length:--text-sm) **:text-(length:--text-sm)",
      default: "text-base *:text-(length:--text-base) **:text-(length:--text-base)",
      lg: "text-lg *:text-(length:--text-lg) **:text-(length:--text-lg)",
      xl: "text-xl *:text-(length:--text-xl) **:text-(length:--text-xl)",
      "2xl": "text-2xl *:text-(length:--text-2xl) **:text-(length:--text-2xl)",
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
