"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleLarge() {
  return (
    <Toggle size="lg">
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
