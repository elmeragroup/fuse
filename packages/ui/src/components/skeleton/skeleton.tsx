import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";

export type SkeletonProps = ComponentProps<"div">;

/**
 * Shape-only loading placeholder. Server component — it owns no
 * state, no handlers, and no browser APIs (performance.md §RSC classification).
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
