"use client";

import { Separator } from "@elmeragroup/fuse/separator";

export function SeparatorVertical() {
  return (
    <div className="flex items-center gap-4">
      <a href="#docs">Docs</a>
      <Separator orientation="vertical" />
      <a href="#source">Source</a>
    </div>
  );
}
