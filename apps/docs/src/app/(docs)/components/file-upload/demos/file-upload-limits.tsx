"use client";

import { useEffect, useRef, useState } from "react";

import { Alert } from "@elmeragroup/fuse/alert";
import { Attachment } from "@elmeragroup/fuse/attachment";
import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import type { FileRejection } from "@elmeragroup/fuse/file-upload";
import { Files, Plus, X } from "@elmeragroup/fuse/icons";

const MAX_FILES = 3;
const MAX_BYTES = 5_000_000;

type AddedFile = {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  /** An object URL for an image's preview, revoked when the file is removed. */
  readonly previewUrl: string | undefined;
};

function formatSize(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function rejectionText(rejection: FileRejection): string {
  switch (rejection.reason) {
    case "type":
      return `${rejection.file.name} is not an image or a PDF.`;
    case "count":
      return `${rejection.file.name} was not added.`;
    case "directory":
      return `${rejection.name} is a folder.`;
    case "unreadable":
      return `${rejection.name} could not be read.`;
  }
}

export function FileUploadLimits() {
  const [files, setFiles] = useState<readonly AddedFile[]>([]);
  const [problems, setProblems] = useState<readonly string[]>([]);
  // The parent revokes the previews. A revoke in a row's effect would run under StrictMode's
  // double mount and break a preview that is still on screen.
  const previews = useRef(new Set<string>());
  // FileUpload calls onSelect and then onReject for one pick, drop or paste, in the same task.
  // The lines both report are gathered here and shown together once that task ends.
  const pending = useRef<string[] | null>(null);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function report(lines: readonly string[]): void {
    if (pending.current === null) {
      const batch: string[] = [];
      pending.current = batch;
      queueMicrotask(() => {
        pending.current = null;
        setProblems(batch);
      });
    }
    pending.current.push(...lines);
  }

  // The limits are the app's own: Fuse checks `accept` and `multiple`, and the app checks the
  // rest before it keeps a file.
  function add(selected: readonly File[]): void {
    const lines: string[] = [];
    const kept: AddedFile[] = [];
    let room = MAX_FILES - files.length;
    for (const file of selected) {
      if (file.size > MAX_BYTES) {
        lines.push(`${file.name} is over 5 MB.`);
      } else if (room === 0) {
        lines.push(`${file.name} was not added, because the limit is ${MAX_FILES} files.`);
      } else {
        room -= 1;
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        if (previewUrl !== undefined) previews.current.add(previewUrl);
        kept.push({ id: crypto.randomUUID(), name: file.name, size: formatSize(file.size), previewUrl });
      }
    }
    setFiles((current) => [...current, ...kept]);
    report(lines);
  }

  function remove(file: AddedFile): void {
    if (file.previewUrl !== undefined) {
      URL.revokeObjectURL(file.previewUrl);
      previews.current.delete(file.previewUrl);
    }
    setFiles((current) => current.filter((entry) => entry.id !== file.id));
  }

  return (
    <FileUpload.Root
      accept="image/png,image/jpeg,image/webp,.pdf"
      multiple
      onSelect={add}
      onReject={(rejections) => report(rejections.map(rejectionText))}
      className="max-w-md w-full">
      <FileUpload.Dropzone>
        <FileUpload.Trigger render={<Button size="sm" />}>
          <Plus data-icon="inline-start" />
          Add files
        </FileUpload.Trigger>
        <FileUpload.Description>Images or PDFs, up to 3 files of 5 MB each.</FileUpload.Description>
      </FileUpload.Dropzone>
      {problems.length > 0 ? (
        <Alert.Root variant="destructive">
          <Alert.Title>Some files were not added</Alert.Title>
          <Alert.Description>{problems.join(" ")}</Alert.Description>
        </Alert.Root>
      ) : null}
      {files.length > 0 ? (
        <Attachment.Group aria-label="Attached files" className="w-full">
          {files.map((file) => (
            <Attachment.Root key={file.id}>
              {file.previewUrl === undefined ? (
                <Attachment.Media>
                  <Files />
                </Attachment.Media>
              ) : (
                <Attachment.Media variant="image">
                  <img src={file.previewUrl} alt={file.name} />
                </Attachment.Media>
              )}
              <Attachment.Content>
                <Attachment.Title>{file.name}</Attachment.Title>
                <Attachment.Description>{file.size}</Attachment.Description>
              </Attachment.Content>
              <Attachment.Actions>
                <Attachment.Action aria-label={`Remove ${file.name}`} onClick={() => remove(file)}>
                  <X />
                </Attachment.Action>
              </Attachment.Actions>
            </Attachment.Root>
          ))}
        </Attachment.Group>
      ) : null}
    </FileUpload.Root>
  );
}
