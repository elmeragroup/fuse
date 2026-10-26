"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";

export function FileUploadPicker() {
  const [name, setName] = useState<string | null>(null);

  return (
    <FileUpload.Root accept=".pdf" onSelect={([file]) => setName(file?.name ?? null)} className="items-start">
      <FileUpload.Trigger render={<Button variant="outline" size="sm" />}>Choose file</FileUpload.Trigger>
      <FileUpload.Description>One PDF.</FileUpload.Description>
      {name === null ? null : <p className="text-sm">{name}</p>}
    </FileUpload.Root>
  );
}
