"use client";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function TogglePressed() {
  return (
    <Toggle defaultPressed>
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
