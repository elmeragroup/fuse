"use client";

import { Separator } from "@elmeragroup/fuse/separator";

export function SeparatorHorizontal() {
  return (
    <div className="flex w-64 flex-col gap-3">
      <p>Documentation</p>
      <Separator />
      <p>Source</p>
    </div>
  );
}
