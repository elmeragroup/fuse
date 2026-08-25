"use client";

import { Emoji } from "@elmeragroup/ui/emoji";

export function EmojiSizing() {
  return (
    <div className="flex items-end gap-4">
      <Emoji.SlightlySmilingFace className="size-4" />
      <Emoji.SlightlySmilingFace className="size-5" />
      <Emoji.SlightlySmilingFace className="size-8" />
    </div>
  );
}
