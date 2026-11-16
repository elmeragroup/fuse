"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleSmall() {
  return (
    <Toggle size="sm">
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
