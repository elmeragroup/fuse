"use client";

import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { spanVariants } from "./span-variants";

/** `Span` takes a native span's props plus the recipe axes and `render`. */
export type SpanProps = ComponentPropsWithoutRef<"span"> &
  Omit<VariantProps<typeof spanVariants>, "leading" | "weight"> & {
    /**
     * The line height. Span defaults to `snug`, Tailwind's 1.375 ratio. It does not take the
     * theme's paragraph line height, as a Text without `leading` does.
     */
    leading?: VariantProps<typeof spanVariants>["leading"];
    /** The font weight. `bold` renders at the medium weight, which caps body text weight. */
    weight?: VariantProps<typeof spanVariants>["weight"];
    /** Replaces the host `span`. */
    render?: useRender.RenderProp;
  };

/**
 * An inline `span` with Text's type axes.
 *
 * @param props - The recipe axes, the host element and the native span props.
 * @returns The rendered span element, with `data-slot="span"`.
 */
export function Span({
  className,
  variant = "default",
  size = "default",
  leading = "snug",
  truncate,
  weight = "normal",
  align,
  render,
  ...props
}: SpanProps): ReactElement {
  return useRender({
    defaultTagName: "span",
    props: {
      "data-slot": "span",
      ...mergeProps<"span">(
        {
          className: cn(spanVariants({ variant, size, leading, truncate, weight, align }), className),
        },
        props
      ),
    },
    render,
  });
}

Span.displayName = "Span";
