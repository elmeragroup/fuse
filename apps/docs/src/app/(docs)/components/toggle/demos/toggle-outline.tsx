"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleOutline() {
  return (
    <Toggle variant="outline">
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
