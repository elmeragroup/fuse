/**
 * Package-private typography fragments shared by Heading, Text and Link. Nothing here is
 * exported through `package.json#exports`; the recipes stay public from their own entries
 * (`headingVariants`, `textVariants`, `linkVariants`).
 *
 * Size, font, weight, leading, prose, truncate, and descendant size selectors
 * stay on the recipes — those axes differ on purpose.
 *
 * Heading and Text compose this recipe with `tv({ extend: typographyFragments, … })`
 * so they inherit `variant` and `align` without restating the class strings. Text
 * then adds `success` and `justify`. Link does **not** extend: `extend` would merge
 * every arm into `LinkProps["variant"]`. Instead it reads
 * `typographyFragments.variants.variant`, leaves out `secondary` and `inherit`, and
 * re-keys the `destructive` class as `error`.
 *
 * `destructive` keeps the ref value name; the class is `text-error`.
 *
 * `secondary` is an identity alias of `foreground`, kept for consumer compatibility and
 * deprecated: `--secondary` is a surface token, never a text role. See the arm itself.
 */
import { tv } from "./tv";

export const typographyFragments = tv({
  variants: {
    variant: {
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      /**
       * @deprecated Identity alias of `foreground` — `--secondary` is a surface token, not
       * a text role (a `muted-foreground` remap fails 4.5:1 at `xs` in several themes).
       * Use `foreground`, or `muted` where a softer tone is wanted; the arm is kept for
       * consumer compatibility and can only be removed in a major.
       */
      secondary: "text-foreground",
      brand: "text-brand",
      muted: "text-muted-foreground",
      inherit: "text-inherit",
      destructive: "text-error",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
});
