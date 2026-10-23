"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import { Plus } from "@elmeragroup/fuse/icons";

const MAX_FILES = 3;

export function FileUploadCompact() {
  const [names, setNames] = useState<readonly string[]>([]);

  return (
    <FileUpload.Root
      multiple
      onSelect={(files) => {
        setNames((current) => [...current, ...files.map((file) => file.name)].slice(0, MAX_FILES));
      }}
      className="max-w-md w-full">
      <FileUpload.Dropzone>
        <FileUpload.Trigger render={<Button size="sm" />}>
          <Plus data-icon="inline-start" />
          Add files
        </FileUpload.Trigger>
        <FileUpload.Description>Drop files here or click to browse (max 3 files)</FileUpload.Description>
      </FileUpload.Dropzone>
      {names.length > 0 ? <p className="text-sm text-muted-foreground">{names.join(", ")}</p> : null}
    </FileUpload.Root>
  );
}
