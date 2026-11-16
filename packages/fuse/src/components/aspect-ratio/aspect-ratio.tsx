import type { ComponentProps, ReactElement, ReactNode } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { aspectRatioVariants } from "./aspect-ratio-variants";

/**
 * A ratio AspectRatio frames content in, written width first. `"16:9"` is wider than tall, and
 * `"9:16"` is the same shape upright.
 */
export type AspectRatioValue = NonNullable<VariantProps<typeof aspectRatioVariants>["ratio"]>;

/** `AspectRatio` takes a native `div`'s props plus the required `ratio`. */
export type AspectRatioProps = Omit<ComponentProps<"div">, "className" | "children"> & {
  /**
   * The frame's width to height, written to `data-ratio`. It is required. For a ratio outside the
   * set, pass an `aspect-*` class in `className`.
   */
  ratio: AspectRatioValue;
  /**
   * Extra classes. Give the frame a width, such as `w-full max-w-md`, and its height follows the
   * ratio. An `aspect-*` class, such as `aspect-[7/5]`, replaces the ratio.
   */
  className?: ComponentProps<"div">["className"];
  /**
   * The content, which fills the frame. Give an `img` or `video` `size-full object-cover`, so it
   * crops to the frame instead of stretching. Round and fill the child, not the frame.
   */
  children?: ReactNode;
};

/** A `div` that keeps one of seven fixed width-to-height ratios as its width changes. */
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
