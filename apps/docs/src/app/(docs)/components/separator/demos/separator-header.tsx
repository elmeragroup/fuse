"use client";

import { Separator } from "@elmeragroup/fuse/separator";

export function SeparatorHeader() {
  return (
    <div className="flex h-12 items-center gap-3 border-b px-4">
      <span className="text-sm font-medium">Orders</span>
      <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-auto" />
      <span className="text-sm text-muted-foreground">March 2026</span>
    </div>
  );
}
