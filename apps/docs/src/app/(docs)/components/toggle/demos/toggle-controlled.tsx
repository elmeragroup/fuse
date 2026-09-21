"use client";

import { useState } from "react";

import { Star } from "@elmeragroup/fuse/icons";
import { Toggle } from "@elmeragroup/fuse/toggle";

export function ToggleControlled() {
  const [pressed, setPressed] = useState(true);
  return (
    <Toggle pressed={pressed} onPressedChange={setPressed}>
      <Star data-icon="inline-start" aria-hidden />
      Favorite
    </Toggle>
  );
}
