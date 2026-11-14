import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { skeletonClass } from "./skeleton-class";

/** `Skeleton` takes a native `div`'s props. */
export type SkeletonProps = ComponentProps<"div"> & {
  /**
   * The skeleton's size and radius, such as `h-4 w-48` or `size-10 rounded-full`. The pulse and
   * the muted fill are the skeleton's own. The skeleton is hidden from screen readers, so mark the
   * region that is loading with `aria-busy`.
   */
  className?: ComponentProps<"div">["className"];
};

/**
 * A shape-only loading placeholder. It is a server component: it owns no state, no handlers and
 * no browser APIs.
 */
export function Skeleton({ className, ...props }: SkeletonProps): ReactElement {
  return <div data-slot="skeleton" aria-hidden="true" className={cn(skeletonClass, className)} {...props} />;
}

Skeleton.displayName = "Skeleton";
