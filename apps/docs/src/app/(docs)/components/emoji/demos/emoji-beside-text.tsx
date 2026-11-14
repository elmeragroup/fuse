"use client";

import { Emoji } from "@elmeragroup/fuse/emoji";

export function EmojiBesideText() {
  return (
    <span className="text-sm flex items-center gap-2">
      <Emoji.SlightlySmilingFace className="size-5" />
      Satisfied
    </span>
  );
}
