"use client";

import { useState } from "react";

import { FileUpload } from "@elmeragroup/fuse/file-upload";

export function FileUploadDemo() {
  const [names, setNames] = useState<readonly string[]>([]);

  return (
    <FileUpload.Root
      multiple
      onSelect={(files) => {
        setNames((current) => [...current, ...files.map((file) => file.name)]);
      }}
      className="max-w-lg w-full">
      <FileUpload.Dropzone>
        <FileUpload.Trigger>Add files</FileUpload.Trigger>
        <FileUpload.Description>Drop files here or choose them.</FileUpload.Description>
      </FileUpload.Dropzone>
      {names.length > 0 ? <p className="text-sm text-muted-foreground">{names.join(", ")}</p> : null}
    </FileUpload.Root>
  );
}
