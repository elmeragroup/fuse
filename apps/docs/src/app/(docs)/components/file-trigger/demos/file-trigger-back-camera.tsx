"use client";

import { FileTrigger } from "@elmeragroup/fuse/file-trigger";

export function FileTriggerBackCamera() {
  return (
    <FileTrigger accept="image/*" capture="environment">
      Take photo
    </FileTrigger>
  );
}
