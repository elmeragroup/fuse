"use client";

import { FileTrigger } from "@elmeragroup/fuse/file-trigger";

export function FileTriggerFrontCamera() {
  return (
    <FileTrigger accept="image/*" capture="user">
      Take selfie
    </FileTrigger>
  );
}
