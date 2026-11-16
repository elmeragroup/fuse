"use client";

import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";

export function FileUploadDisabled() {
  return (
    <FileUpload.Root disabled className="max-w-lg w-full">
      <FileUpload.Dropzone>
        <FileUpload.Trigger render={<Button size="sm" />}>Add files</FileUpload.Trigger>
        <FileUpload.Description>Uploads open when the meter is registered.</FileUpload.Description>
      </FileUpload.Dropzone>
    </FileUpload.Root>
  );
}
