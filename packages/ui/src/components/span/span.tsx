"use client";

import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { spanVariants } from "./span-variants";

export type SpanProps = Omit<ComponentPropsWithoutRef<"span">, "slot"> &
  VariantProps<typeof spanVariants> & {
    /**
     * Replaces the host element via base-ui `useRender`. The host stays a
     * `span` when omitted — the forced-span identity is kept.
     */
    render?: useRender.RenderProp;
  };

/**
 * Forced inline `span` typography primitive. Same recipe surface as Text, with
 * `leading` defaulting to `snug`. Polymorphism is `render` via base-ui
 * `useRender`, never `as`.
 */
export function Span({
  className,
  variant,
  size,
  leading,
  truncate,
  weight,
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
