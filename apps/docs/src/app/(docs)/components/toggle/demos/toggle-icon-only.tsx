"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleIconOnly() {
  return (
    <Toggle aria-label="Favorite">
      <Star aria-hidden />
    </Toggle>
  );
}
