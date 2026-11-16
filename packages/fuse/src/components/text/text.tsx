"use client";

import type { ComponentPropsWithoutRef, JSX, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { textVariants } from "./text-variants";

/** `Text` takes a native paragraph's props plus the recipe axes, `elementType` and `render`. */
export type TextProps = ComponentPropsWithoutRef<"p"> &
  Omit<VariantProps<typeof textVariants>, "size" | "leading" | "weight"> & {
    /**
     * The font size. Descendants take the same font size. Descendants without their own line
     * height inherit the Text's, so a `<strong>` inside keeps the paragraph's type. An element's
     * own line height wins, such as a `Span`'s default `snug`.
     */
    size?: VariantProps<typeof textVariants>["size"];
    /**
     * The line height. When unset, `sm`, `default` and `lg` text reads the theme's
     * `--paragraph-leading-sm`, `--paragraph-leading-base` and `--paragraph-leading-lg`, and the
     * other sizes are relaxed. A leading or size class in `className` replaces the theme's line
     * height too.
     */
    leading?: VariantProps<typeof textVariants>["leading"];
    /** The font weight. `bold` renders at the medium weight, which caps body text weight. */
    weight?: VariantProps<typeof textVariants>["weight"];
    /** The tag rendered when `render` is unset, such as `"span"` or `"div"`. */
    elementType?: keyof JSX.IntrinsicElements;
    /** Replaces the host element. Prefer it to `elementType` for a component or an element with props. */
    render?: useRender.RenderProp;
  };

/**
 * A paragraph of body text, or another text element through `elementType` or `render`.
 *
 * @param props - The recipe axes, the host element and the native paragraph props.
 * @returns The rendered text element, with `data-slot="text"`.
 */
export function Text({
  className,
  variant = "default",
  size = "default",
  leading,
  truncate,
  weight = "normal",
  align,
  elementType = "p",
  render,
  ...props
}: TextProps): ReactElement {
  return useRender({
    defaultTagName: elementType,
    props: {
      "data-slot": "text",
      ...mergeProps<"p">(
        {
          className: cn(textVariants({ variant, size, leading, truncate, weight, align }), className),
        },
        props
      ),
    },
    render,
  });
}

Text.displayName = "Text";
