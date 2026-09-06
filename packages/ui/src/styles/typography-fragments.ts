/**
 * Package-private typography fragments shared by Heading, Text and the interim tier's
 * Link. Nothing here is exported through `package.json#exports`; recipes stay public from
 * their own entries (`headingVariants` / `textVariants`), and `linkVariants` is
 * package-private like the rest of the quarantined tier.
 *
 * Size, font, weight, leading, prose, truncate, and descendant size selectors
 * stay on the recipes — those axes differ on purpose.
 *
 * Heading and Text compose this recipe with `tv({ extend: typographyFragments, … })`
 * so they inherit `variant` and `align` without restating the class strings. Text
 * then adds `success` and `justify`. Link does **not** extend: `extend` would merge
 * the `destructive` arm into `LinkProps["variant"]`. Instead it reads
 * `typographyFragments.variants.variant`, omits `destructive`, and re-keys that
 * class as `error`. Align is the same read, plus Link's `justify`.
 *
 * `destructive` keeps the ref value name; the class is `text-error`.
 */
import { tv } from "tailwind-variants";

export const typographyFragments = tv({
  variants: {
    variant: {
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      secondary: "text-secondary",
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
