"use client";

import { Skeleton } from "@elmeragroup/fuse/skeleton";

export function SkeletonDemo() {
  return (
    <div aria-busy="true" className="max-w-sm w-full">
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
