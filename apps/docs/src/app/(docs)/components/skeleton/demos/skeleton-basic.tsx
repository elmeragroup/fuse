"use client";

import { Skeleton } from "@elmeragroup/ui/skeleton";

export function SkeletonBasic() {
  return (
    <div aria-busy="true" className="flex items-center gap-4">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex w-full flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}
