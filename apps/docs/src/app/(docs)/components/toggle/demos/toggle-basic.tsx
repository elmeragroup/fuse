"use client";

import { Star } from "@elmeragroup/ui/icons";
import { Toggle } from "@elmeragroup/ui/toggle";

export function ToggleBasic() {
  return (
    <Toggle>
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
