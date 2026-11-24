import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";
import { typographyFragments } from "../../styles/typography-fragments";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * Text's colors minus the two arms Link leaves out, with Text's `destructive` class under
 * Link's own `error` key. `secondary` is Text's deprecated alias of `foreground` and `inherit`
 * repeats `default`, so neither would draw a distinct link. `extend: typographyFragments` would
 * merge every arm and widen `LinkProps["variant"]` with them.
 */
const {
  destructive: errorColorClass,
  secondary: _secondary,
  inherit: _inherit,
  ...linkColorClasses
} = typographyFragments.variants.variant;

/**
 * The public recipe, exported from `@elmeragroup/fuse/link` beside `Link`.
 *
 * Link is text in a sentence, so the base sets no font, size, line height or display. The anchor
 * stays `inline`, takes the surrounding text's type and wraps with it. `weight` leaves the
 * sentence's weight unless it is set. The underline offset and thickness are in `em`, so they
 * scale with whatever size the sentence is set in, with a 1px floor that keeps a small line
 * visible. The base layer's `a[data-slot]` reset in `fuse.css` clears the browser's link color
 * and underline first, and weighs nothing, so these classes and a consumer's own win.
 *
 * `underline` sets the cue that tells a link from its sentence.
 * - `always`, the default, underlines at rest in a dimmed line, the link's color at 35% in a
 *   light scheme and 65% in a dark one, and draws it in the full color under the pointer. The
 *   default color is the sentence's own, and `primary` is the text color in several themes,
 *   so the underline is the cue a user who misses the color difference still sees.
 *   `light-dark()` picks the share from the `color-scheme` each theme sets, so no theme carries
 *   a link token. A browser without `light-dark()` drops the declaration and draws the line in
 *   the full color.
 * - `hover` underlines only under the pointer, for a link whose place already reads as a link,
 *   such as a row of footer links.
 * - `none` draws no underline at rest or under the pointer, for a link its place already marks,
 *   such as a card's title or a nav item. The text keeps full opacity under the pointer. `muted`
 *   and `brand` text sit near the 4.5:1 floor in some themes, and an 80% fade would take
 *   Fjordkraft's neutral light muted text from 4.98:1 to 3.35:1.
 *
 * The keyboard ring paints the shared self focus ring. `box-decoration-clone` gives each line
 * of a wrapped link its own whole ring, where the default slicing leaves the line ends open.
 * An inline SVG child, such as an external-link icon, is drawn `1em` square on the text's
 * baseline in the link's color. Mark it `data-icon="inline-end"` or `data-icon="inline-start"`,
 * as on Button, and it keeps `0.25em` from the text, and the link keeps to one line. Chromium
 * breaks a line between a word and an inline SVG even with no space between them, which would
 * leave the icon alone at the start of the next line.
 */
export const linkVariants = tv({
  base: cn(
    "cursor-pointer box-decoration-clone decoration-[max(1px,0.0625em)] underline-offset-[0.2em] transition-[text-decoration-color] has-[>[data-icon]]:whitespace-nowrap [&_svg]:inline [&_svg]:align-[-0.125em] [&_svg:not([class*='size-'])]:size-[1em] [&>[data-icon=inline-end]]:ms-[0.25em] [&>[data-icon=inline-start]]:me-[0.25em]",
    selfFocusRingClass
  ),
  variants: {
    variant: {
      ...linkColorClasses,
      error: errorColorClass,
    },
    underline: {
      always:
        "underline decoration-[color:light-dark(color-mix(in_oklab,currentcolor_35%,transparent),color-mix(in_oklab,currentcolor_65%,transparent))] enabled-hover:decoration-current",
      hover: "no-underline enabled-hover:underline",
      none: "no-underline",
    },
    weight: {
      normal: "font-normal",
      bold: "font-medium",
    },
    truncate: {
      true: "inline-block max-w-full truncate align-bottom",
    },
  },
  defaultVariants: {
    variant: "default",
    underline: "always",
  },
});
