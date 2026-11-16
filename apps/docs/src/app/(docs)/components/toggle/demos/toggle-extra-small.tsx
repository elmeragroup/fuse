"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleExtraSmall() {
  return (
    <Toggle size="xs">
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
