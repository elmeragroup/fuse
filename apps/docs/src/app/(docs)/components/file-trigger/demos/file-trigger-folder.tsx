"use client";

import { FileTrigger } from "@elmeragroup/fuse/file-trigger";

export function FileTriggerFolder() {
  return (
    <FileTrigger directory multiple>
      Choose folder
    </FileTrigger>
  );
}
