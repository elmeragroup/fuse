"use client";

import { Card } from "@elmeragroup/ui/card";
import { Skeleton } from "@elmeragroup/ui/skeleton";

export function SkeletonCard() {
  return (
    <div aria-busy="true">
      <Card.Root>
        <Card.Header>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full max-w-48" />
        </Card.Header>
        <Card.Content className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </Card.Content>
      </Card.Root>
    </div>
  );
}
