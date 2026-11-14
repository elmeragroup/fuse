"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Separator } from "../separator/separator";
import { buttonGroupVariants } from "./button-group-variants";

/** The props of `ButtonGroup.Root`: a native `div`'s props plus the recipe's `orientation`. */
export type ButtonGroupRootProps = Omit<ComponentProps<"div">, "children"> & {
  /** The axis the segments join along. */
  orientation?: VariantProps<typeof buttonGroupVariants>["orientation"];
  /**
   * The segments: Buttons, `ButtonGroup.Text`, fields and nested groups. A child with a
   * `data-slot` joins the group, which squares its inner corners and merges the borders it shares
   * with its neighbours. A filled Button, `default` or `secondary`, shows no seam against its
   * neighbour, so put a `ButtonGroup.Separator` between filled Buttons.
   */
  children?: ReactNode;
};

/** The props of `ButtonGroup.Separator`: Separator's props with the hairline's axis. */
export type ButtonGroupSeparatorProps = Omit<
  ComponentProps<typeof Separator>,
  "orientation" | "className"
> & {
  /** Extra classes, merged after the hairline's own. */
  className?: ComponentProps<typeof Separator>["className"];
  /**
   * The hairline's axis. A horizontal group needs a vertical hairline, so set `horizontal` in a
   * vertical group.
   */
  orientation?: ComponentProps<typeof Separator>["orientation"];
};

export type ButtonGroupTextProps = useRender.ComponentProps<"div">;

/** A row or column of Buttons and other controls joined into one control. */
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
 * The hairline between two segments. It is the library's Separator with a `data-slot`, so the
 * group joins it like any other segment.
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

/** A static text segment, such as a unit or a prefix, that sits flush with the Buttons beside it. */
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
