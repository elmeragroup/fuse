"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { headingVariants } from "./heading-variants";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function getSizeByHeadingLevel(level: number): VariantProps<typeof headingVariants>["size"] {
  switch (level) {
    case 1:
      return "2xl";
    case 2:
      return "lg";
    default:
      return "default";
  }
}

export type HeadingProps = useRender.ComponentProps<"h2"> &
  VariantProps<typeof headingVariants> & {
    /**
     * Document-outline level — `1`–`6` picks the rendered `h1`–`h6`. Defaults to `2`.
     * Visual `size` is independent of `level`.
     */
    level?: HeadingLevel;
  };

/**
 * Plain `h1`–`h6` typography primitive. `level` owns the document outline; `size` owns
 * the type scale. Polymorphism is `render` via base-ui `useRender`, never `as`.
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
        className: cn(
          headingVariants({
            variant,
            size: size ?? getSizeByHeadingLevel(level),
            font,
            noMargin,
            uppercase,
            align,
          }),
          className
        ),
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
