"use client";

import { Emoji } from "@elmeragroup/fuse/emoji";

export function EmojiFaces() {
  return (
    <div className="flex items-center gap-3">
      <Emoji.SlightlyFrowningFace className="size-8" />
      <Emoji.SlightlySmilingFace className="size-8" />
      <Emoji.NeutralFace className="size-8" />
      <Emoji.LoudlyCryingFace className="size-8" />
      <Emoji.PartyingFace className="size-8" />
    </div>
  );
}
