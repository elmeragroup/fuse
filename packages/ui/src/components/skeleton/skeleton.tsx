import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { skeletonVariants } from "./skeleton-variants";

/** Public props for `Skeleton`: native div attributes plus the `silhouette` recipe axis. */
export type SkeletonProps = ComponentProps<"div"> & VariantProps<typeof skeletonVariants>;

/**
 * Shape-only loading placeholder. Server component — it owns no
 * state, no handlers, and no browser APIs (performance.md §RSC classification).
 */
export function Skeleton({ className, silhouette, ...props }: SkeletonProps): ReactElement {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(skeletonVariants({ silhouette }), className)}
      {...props}
    />
  );
}

Skeleton.displayName = "Skeleton";
