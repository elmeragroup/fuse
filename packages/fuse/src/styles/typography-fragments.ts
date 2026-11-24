/**
 * Package-private typography fragments shared by Heading, Text and Link. Nothing here is
 * exported through `package.json#exports`. The recipes stay public from their own entries as
 * `headingVariants`, `textVariants` and `linkVariants`.
 *
 * Size, font, weight, leading, prose, truncate and descendant size selectors
 * stay on the recipes, because those axes differ on purpose.
 *
 * Heading and Text compose this recipe with `tv({ extend: typographyFragments, … })`
 * so they inherit `variant` and `align` without restating the class strings. Text
 * then adds `success` and `justify`. Link does not extend, because `extend` would merge
 * every arm into `LinkProps["variant"]`. Instead it reads
 * `typographyFragments.variants.variant`, leaves out `secondary` and `inherit`, and
 * re-keys the `destructive` class as `error`.
 *
 * `destructive` keeps the ref value name; the class is `text-error`.
 *
 * `brand` sets `text-brand-ink`, not `text-brand`. `--brand` fills brand shapes and falls under
 * 4.5:1 on the page in some themes, and `--brand-ink` is the brand stepped to 4.5:1 on the page
 * and on a Card.
 *
 * `secondary` is an identity alias of `foreground`, kept for consumer compatibility and
 * deprecated: `--secondary` is a surface token, never a text role. See the arm itself.
 */
import { tv } from "./tv";

/**
 * The `variant` prop of `Heading`, `Text`, `Span` and `Link`, over each one's own variant union.
 * It is package-private.
 *
 * @template Variant - The component's variant union.
 */
export type TextColorProps<Variant> = {
  /**
   * The text color. `default` takes the color of the text around it, so text in an error message
   * is the error color. The others set a text role. `brand` sets the brand color as text at 4.5:1
   * or more on the page and on a Card in every theme. On another surface, such as a filled panel
   * or the Sidebar, check its contrast. To recolor brand text, override `--brand-ink`, not
   * `--brand`, on the element that carries the theme attributes. Some themes declare
   * `--brand-ink` as its own color, and a `--brand` override leaves that color unchanged.
   */
  variant?: Variant;
};

export const typographyFragments = tv({
  variants: {
    variant: {
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      /**
       * @deprecated Identity alias of `foreground`. `--secondary` is a surface token, not
       * a text role, and a `muted-foreground` remap fails 4.5:1 at `xs` in several themes.
       * Use `foreground`, or `muted` where a softer tone is wanted; the arm is kept for
       * consumer compatibility and can only be removed in a major.
       */
      secondary: "text-foreground",
      brand: "text-brand-ink",
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
