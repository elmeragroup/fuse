"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Field } from "@elmeragroup/fuse/field";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import type { FileRejection } from "@elmeragroup/fuse/file-upload";

/** What one rejection says, by its reason. */
function reasonMessage(rejection: FileRejection): string {
  switch (rejection.reason) {
    case "type":
      return `${rejection.file.name} is not an image.`;
    case "count":
      return "Choose one photo at a time.";
    case "directory":
      return `${rejection.name} is a folder. Choose a photo.`;
    case "unreadable":
      return `${rejection.name} could not be read.`;
  }
}

/**
 * The error the Field shows for one pick, drop or paste that `onReject` reports: one sentence per
 * reason, so two images on this single-file Root say so once.
 */
function rejectionMessage(rejections: readonly FileRejection[]): string {
  return [...new Set(rejections.map(reasonMessage))].join(" ");
}

export function FileUploadField() {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Field.Root invalid={error !== null} className="max-w-lg w-full">
      <Field.Label>Meter photo</Field.Label>
      <FileUpload.Root
        accept="image/*"
        onSelect={([file]) => {
          setName(file?.name ?? null);
          setError(null);
        }}
        onReject={(rejections) => {
          setError(rejectionMessage(rejections));
        }}>
        <FileUpload.Dropzone>
          <FileUpload.Trigger render={<Button variant="outline" size="sm" />}>Choose file</FileUpload.Trigger>
          <FileUpload.Description>{name ?? "Drop a photo here"}</FileUpload.Description>
        </FileUpload.Dropzone>
      </FileUpload.Root>
      {error === null ? null : <Field.Error>{error}</Field.Error>}
      <Field.Description>A photo of the meter display, so we can read your usage.</Field.Description>
    </Field.Root>
  );
}
