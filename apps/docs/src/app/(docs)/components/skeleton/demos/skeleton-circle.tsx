"use client";

import { Skeleton } from "@elmeragroup/fuse/skeleton";

export function SkeletonCircle() {
  return (
    <div aria-busy="true">
      <Skeleton className="size-10 rounded-full" />
    </div>
  );
}
