"use client";

import { Star } from "@elmeragroup/ui/icons";
import { Toggle } from "@elmeragroup/ui/toggle";

export function ToggleSizes() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle size="xs">
        <Star data-icon="inline-start" aria-hidden />
        Extra small
      </Toggle>
      <Toggle size="sm">
        <Star data-icon="inline-start" aria-hidden />
        Small
      </Toggle>
      <Toggle size="default">
        <Star data-icon="inline-start" aria-hidden />
        Default
      </Toggle>
      <Toggle size="lg">
        Large
        <Star data-icon="inline-end" aria-hidden />
      </Toggle>
    </div>
  );
}
