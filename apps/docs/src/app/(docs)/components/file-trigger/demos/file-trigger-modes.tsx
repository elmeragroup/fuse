"use client";

import { FileTrigger } from "@elmeragroup/fuse/react-aria/file-trigger";

export function FileTriggerModes() {
  return (
    <div className="flex flex-wrap gap-3">
      <FileTrigger>Attach file</FileTrigger>
      <FileTrigger defaultCamera="environment">Take photo</FileTrigger>
      <FileTrigger acceptDirectory>Choose folder</FileTrigger>
    </div>
  );
}
