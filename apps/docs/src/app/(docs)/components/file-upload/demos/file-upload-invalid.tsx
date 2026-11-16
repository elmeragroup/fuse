"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { FileUpload } from "@elmeragroup/fuse/file-upload";

export function FileUploadInvalid() {
  return (
    <Field.Root invalid className="max-w-lg w-full">
      <Field.Label>Meter photo</Field.Label>
      <FileUpload.Root accept="image/*">
        <FileUpload.Dropzone>
          <FileUpload.Trigger render={<Button size="sm" />}>Choose file</FileUpload.Trigger>
          <FileUpload.Description>Drop a photo here</FileUpload.Description>
        </FileUpload.Dropzone>
      </FileUpload.Root>
      <Field.Error>Add a photo of the meter display.</Field.Error>
    </Field.Root>
  );
}
