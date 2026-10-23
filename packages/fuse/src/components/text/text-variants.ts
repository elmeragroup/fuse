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
 *
 * Without a `leading` prop, the `sm`, `default` and `lg` arms set the line height from the
 * theme's paragraph roles, `--paragraph-leading-sm`, `--paragraph-leading-base` and
 * `--paragraph-leading-lg`: the relaxed 1.625 ratio in internal themes and the 14/20, 16/22
 * and 18/24 paragraph styles in external ones. On a host without `themes.css`, each falls back
 * to its internal default, the same relaxed line height as a length. The `xs`, `xl` and `2xl`
 * arms keep a plain `leading-relaxed`.
 * The leading class must follow the arm's `text-<size>`, because tailwind-merge drops a
 * leading class that a later font-size class follows. An explicit `leading` prop comes after
 * the size arm and replaces the role, and so does a `className` leading. A `className` size,
 * such as `text-lg`, drops the role as well, leaving that size's own line height.
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
      xs: "text-xs leading-relaxed *:text-(length:--text-xs) **:text-(length:--text-xs)",
      sm: "text-sm leading-(--paragraph-leading-sm,1.421875rem) *:text-(length:--text-sm) **:text-(length:--text-sm)",
      default:
        "text-base leading-(--paragraph-leading-base,1.625rem) *:text-(length:--text-base) **:text-(length:--text-base)",
      lg: "text-lg leading-(--paragraph-leading-lg,1.828125rem) *:text-(length:--text-lg) **:text-(length:--text-lg)",
      xl: "text-xl leading-relaxed *:text-(length:--text-xl) **:text-(length:--text-xl)",
      "2xl": "text-2xl leading-relaxed *:text-(length:--text-2xl) **:text-(length:--text-2xl)",
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
    weight: "normal",
  },
});
