"use client";

import { useRef, useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import type { FileRejection } from "@elmeragroup/fuse/file-upload";

const MAX_FILES = 3;
const MAX_BYTES = 5_000_000;

type AddedFile = { readonly id: string; readonly name: string; readonly size: string };

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
  // FileUpload calls onSelect and then onReject for one pick, drop or paste, in the same task.
  // The lines both report are gathered here and shown together once that task ends.
  const pending = useRef<string[] | null>(null);

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

  // The limits are the app's own: FileUpload checks `accept` and `multiple`, and the app checks
  // the rest before it keeps a file.
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
        kept.push({ id: crypto.randomUUID(), name: file.name, size: formatSize(file.size) });
      }
    }
    setFiles((current) => [...current, ...kept]);
    report(lines);
  }

  return (
    <FileUpload.Root
      accept="image/png,image/jpeg,image/webp,.pdf"
      multiple
      onSelect={add}
      onReject={(rejections) => report(rejections.map(rejectionText))}
      className="max-w-md w-full">
      <FileUpload.Dropzone>
        <FileUpload.Trigger render={<Button size="sm" />}>Add files</FileUpload.Trigger>
        <FileUpload.Description>Images or PDFs, up to 3 files of 5 MB each.</FileUpload.Description>
      </FileUpload.Dropzone>
      <p role="alert" className="text-sm text-error">
        {problems.join(" ")}
      </p>
      {files.length > 0 ? (
        <ul aria-label="Attached files" className="text-sm flex w-full flex-col gap-1">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2">
              {file.name}, {file.size}
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((current) => current.filter((entry) => entry.id !== file.id))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </FileUpload.Root>
  );
}
