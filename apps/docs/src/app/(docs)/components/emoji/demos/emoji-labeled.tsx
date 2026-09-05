"use client";

import { Emoji } from "@elmeragroup/ui/emoji";

export function EmojiLabeled() {
  return (
    <div className="flex flex-col items-start gap-6">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2">
          <Emoji.SlightlyFrowningFace className="size-5" />
          Unsatisfied
        </span>
        <span className="flex items-center gap-2">
          <Emoji.NeutralFace className="size-5" />
          Neutral
        </span>
        <span className="flex items-center gap-2">
          <Emoji.SlightlySmilingFace className="size-5" />
          Satisfied
        </span>
      </div>
      <Emoji.PartyingFace label="Very satisfied" className="size-5" />
    </div>
  );
}
