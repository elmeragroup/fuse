"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { buttonGroupVariants } from "./button-group-variants";

export type ButtonGroupRootProps = ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>;

export type ButtonGroupSeparatorProps = Omit<ComponentProps<typeof Separator>, "orientation"> & {
  /**
   * Hairline axis. Flipped from the canonical Separator: a horizontal group needs a
   * vertical hairline.
   * @default "vertical"
   */
  orientation?: ComponentProps<typeof Separator>["orientation"];
};

export type ButtonGroupTextProps = useRender.ComponentProps<"div">;

/**
 * Layout container that collapses inner radii and shared borders of `data-slot`
 * children into one visual control. `orientation` defaults so
 * `data-orientation` is always emitted. Filled Buttons (`default`, `secondary`) join
 * with no visible seam because Button's fill paints under its transparent border, so put
 * `ButtonGroup.Separator` between them; `outline` takes its seam from its own border.
 */
export function ButtonGroupRoot({
  className,
  orientation = "horizontal",
  ...props
}: ButtonGroupRootProps): ReactElement {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

/**
 * Hairline divider between segments. Forwards to the canonical library Separator so the
 * group `[data-slot]` join contract stays intact. Default is
 * `"vertical"` — a horizontal group needs a vertical hairline. It is the seam between
 * filled segments (`default`, `secondary`), which otherwise join as one fill.
 */
export function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: ButtonGroupSeparatorProps): ReactElement {
  // No inset at either end: Button paints its fill under its border, so a shorter line
  // would leave a notch of page where it stops.
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={mergeClassName(
        className,
        "relative self-stretch bg-input data-horizontal:w-auto data-vertical:h-auto"
      )}
      {...props}
    />
  );
}

/**
 * Static label/affix segment styled to sit flush with buttons. Polymorphism is
 * `render` via base-ui `useRender` + `mergeProps` — the convention exemplar
 */
export function ButtonGroupText({ className, render, ...props }: ButtonGroupTextProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "text-sm font-medium shadow-xs flex items-center gap-2 rounded-md border bg-muted px-2.5 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "button-group-text",
    },
  });
}

ButtonGroupRoot.displayName = "ButtonGroup.Root";
ButtonGroupSeparator.displayName = "ButtonGroup.Separator";
ButtonGroupText.displayName = "ButtonGroup.Text";
