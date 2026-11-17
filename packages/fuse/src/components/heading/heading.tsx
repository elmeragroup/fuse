"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { headingClass } from "./heading-class";
import type { HeadingLevel } from "./heading-class";
import type { headingVariants } from "./heading-variants";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** Props for `Heading`, which takes a native heading's props plus the recipe axes and the outline `level`. */
export type HeadingProps = useRender.ComponentProps<"h2"> &
  Omit<VariantProps<typeof headingVariants>, "size" | "font"> & {
    /**
     * The outline level, `1` to `6`, which picks the rendered `h1` to `h6`. For levels 1 to 3 it
     * also picks the theme's size, line height and weight: `--heading-<level>-size` and
     * `--heading-<level>-leading` apply when `size` is unset, and `--heading-<level>-weight` when
     * `font` is unset. Neutral themes set h1 to 24/33, h2 to 18/24.75 and h3 to 16/22, all at 500.
     * Branded themes set h1 to 24/32 and h2 and h3 to 20/32, all at 700. Levels 4 to 6 are 16/22
     * at 500 in every theme.
     */
    level?: HeadingLevel;
    /**
     * The type size. Setting it replaces the level's theme size and line height with the
     * recipe's, so use it only where a heading must differ from its level. A size class in
     * `className` replaces them too.
     */
    size?: VariantProps<typeof headingVariants>["size"];
    /**
     * The font weight. Setting it replaces the level's theme weight, and so does a weight class
     * in `className`.
     */
    font?: VariantProps<typeof headingVariants>["font"];
  };

/**
 * An `h1` to `h6` heading. Its `size` and `font` can differ from the type its `level` sets.
 *
 * @param props - The recipe axes, the outline level, the host element and the native heading props.
 * @returns The rendered heading element, with `data-slot="heading"`.
 */
export function Heading({
  className,
  variant = "default",
  size,
  font,
  level = 2,
  noMargin,
  uppercase,
  align,
  render,
  ...props
}: HeadingProps): ReactElement {
  const tag: HeadingTag = `h${level}`;
  return useRender({
    defaultTagName: tag,
    props: mergeProps<"h2">(
      {
        className: cn(headingClass({ level, variant, size, font, noMargin, uppercase, align }), className),
      },
      props
    ),
    render,
    state: {
      slot: "heading",
    },
  });
}

Heading.displayName = "Heading";
