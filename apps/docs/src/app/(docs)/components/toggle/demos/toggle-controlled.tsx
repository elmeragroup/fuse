"use client";

import { useState } from "react";

import { Star } from "@elmeragroup/ui/icons";
import { Toggle } from "@elmeragroup/ui/toggle";

export function ToggleControlled() {
  const [pressed, setPressed] = useState(true);
  return (
    <Toggle pressed={pressed} onPressedChange={setPressed}>
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
