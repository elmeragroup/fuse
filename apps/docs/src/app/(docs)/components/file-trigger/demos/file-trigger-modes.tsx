"use client";

import { FileTrigger } from "@elmeragroup/fuse/file-trigger";

export function FileTriggerModes() {
  return (
    <div className="flex flex-wrap gap-3">
      <FileTrigger>Attach file</FileTrigger>
      <FileTrigger accept="image/*" capture="environment">
        Take photo
      </FileTrigger>
      <FileTrigger directory multiple>
        Choose folder
      </FileTrigger>
    </div>
  );
}
