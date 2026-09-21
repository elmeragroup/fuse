"use client";

import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleVariants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle>Default</Toggle>
      <Toggle variant="outline">Outline</Toggle>
    </div>
  );
}
