"use client";

import { useState } from "react";

import { FileTrigger } from "@elmeragroup/fuse/file-trigger";

export function FileTriggerAccept() {
  const [names, setNames] = useState<readonly string[]>([]);
  const [rejected, setRejected] = useState<readonly string[]>([]);

  return (
    <div className="flex flex-col gap-3">
      <FileTrigger
        accept="image/png,image/jpeg,.pdf"
        multiple
        onSelect={(files) => {
          setNames(files.map((file) => file.name));
          setRejected([]);
        }}
        onReject={(rejections) => {
          setRejected(
            rejections.map((rejection) => ("file" in rejection ? rejection.file.name : rejection.name))
          );
        }}>
        Attach files
      </FileTrigger>
      {names.length > 0 ? <p className="text-sm text-muted-foreground">{names.join(", ")}</p> : null}
      {rejected.length > 0 ? (
        <p className="text-sm text-error">Not a PNG, JPEG or PDF: {rejected.join(", ")}</p>
      ) : null}
    </div>
  );
}
