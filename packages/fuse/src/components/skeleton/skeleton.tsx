import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";

/** Public props for `Skeleton`: native div attributes. Size and radius come through `className`. */
export type SkeletonProps = ComponentProps<"div">;

/**
 * Shape-only loading placeholder. Size and radius are the caller's through `className`; the pulse
 * and muted surface are the component's. Server component — it owns no state, no handlers, and no
 * browser APIs.
 */
export function Skeleton({ className, ...props }: SkeletonProps): ReactElement {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

Skeleton.displayName = "Skeleton";
