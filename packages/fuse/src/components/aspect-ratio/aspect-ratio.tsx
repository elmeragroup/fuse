import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { aspectRatioVariants } from "./aspect-ratio-variants";

/**
 * A ratio AspectRatio frames content in, written width first: `"16:9"` is wider than tall and
 * `"9:16"` is its upright twin.
 */
export type AspectRatioValue = NonNullable<VariantProps<typeof aspectRatioVariants>["ratio"]>;

/** `AspectRatio` takes a native `div`'s props plus the required `ratio`. */
export type AspectRatioProps = ComponentProps<"div"> & {
  /**
   * The frame's width to height, one of `"1:1"`, `"4:3"`, `"3:4"`, `"3:2"`, `"2:3"`, `"16:9"`
   * and `"9:16"`. It has no default. A consumer `aspect-*` class, such as `aspect-[7/5]`,
   * replaces it.
   */
  ratio: AspectRatioValue;
};

/**
 * A `div` that keeps one of seven fixed ratios as its width changes, written to `data-ratio`.
 * It is positioned, so an absolutely placed child fills it, and `size-full` sizes an `img` or
 * `video` child to the frame. It is a server component and takes no `render` prop.
 */
export function AspectRatio({ ratio, className, ...props }: AspectRatioProps): ReactElement {
  return (
    <div
      data-slot="aspect-ratio"
      data-ratio={ratio}
      className={cn(aspectRatioVariants({ ratio }), className)}
      {...props}
    />
  );
}

AspectRatio.displayName = "AspectRatio";
