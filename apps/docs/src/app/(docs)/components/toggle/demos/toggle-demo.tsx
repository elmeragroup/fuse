"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleDemo() {
  return (
    <Toggle>
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
