"use client";

import type { ComponentPropsWithoutRef, JSX, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { textVariants } from "./text-variants";

export type TextProps = Omit<ComponentPropsWithoutRef<"p">, "slot"> &
  VariantProps<typeof textVariants> & {
    /**
     * Tag name rendered when `render` is omitted. Kept from the ref for compat —
     * `"span"` and `"div"` are common. Defaults to `"p"`.
     */
    elementType?: keyof JSX.IntrinsicElements;
    /**
     * Replaces the host element via base-ui `useRender`. `elementType` stays
     * alongside for the existing call sites that pass a tag name.
     */
    render?: useRender.RenderProp;
  };

/**
 * A body paragraph, or another text element through `elementType` or `render`. Without a
 * `leading` prop, its line height at `sm`, the default size and `lg` comes from the theme's
 * `--paragraph-leading-sm`, `--paragraph-leading-base` and `--paragraph-leading-lg`, and the
 * other sizes are relaxed. Descendants inherit the line height and take the Text's font size.
 *
 * @param props - The recipe axes, the host element and the native paragraph props.
 * @returns The rendered text element, with `data-slot="text"`.
 */
export function Text({
  className,
  variant,
  size,
  leading,
  truncate,
  weight,
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
