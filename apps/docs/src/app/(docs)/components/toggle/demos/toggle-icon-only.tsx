"use client";

import { Star } from "@elmeragroup/ui/icons";
import { Toggle } from "@elmeragroup/ui/toggle";

export function ToggleIconOnly() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Toggle aria-label="Favorite start">
        <Star data-icon="inline-start" aria-hidden />
      </Toggle>
      <Toggle aria-label="Favorite end">
        <Star data-icon="inline-end" aria-hidden />
      </Toggle>
    </div>
  );
}
