import { tv } from "../../styles/tv";

/**
 * The AspectRatio recipe: one fraction utility per ratio string. The fractions are literal, so
 * a host that redefines the theme variable behind Tailwind's video ratio utility cannot change a
 * 16:9 frame. Every class is a fixed string, so Tailwind-source and standalone-CSS consumers
 * both get it. Package-private: the facade exports the ratio strings, not the recipe.
 *
 * A direct `img` or `video` child is a block. Inline, it would sit on a text baseline, and the
 * line's descender space would grow the frame past its ratio in a host without Tailwind's
 * preflight.
 */
export const aspectRatioVariants = tv({
  base: "relative [&>img]:block [&>video]:block",
  variants: {
    ratio: {
      "1:1": "aspect-1/1",
      "4:3": "aspect-4/3",
      "3:4": "aspect-3/4",
      "3:2": "aspect-3/2",
      "2:3": "aspect-2/3",
      "16:9": "aspect-16/9",
      "9:16": "aspect-9/16",
    },
  },
  // Required shape: elmera/enforce-variant-standard makes every recipe declare
  // `defaultVariants`. There is no default ratio. AspectRatio requires the prop.
  defaultVariants: {},
});
