"use client";

import { useEffect, useRef, useState } from "react";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Files, SpinnerGap, X } from "@elmeragroup/fuse/icons";
import { FileTrigger } from "@elmeragroup/fuse/react-aria/file-trigger";

type PickedFile = {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  /** An object URL for an image's preview, revoked when the file is removed. */
  readonly previewUrl: string | undefined;
  readonly state: "uploading" | "done";
};

/** How long the demo pretends an upload takes. */
const UPLOAD_MS = 1500;

function formatSize(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function AttachmentUpload() {
  const [files, setFiles] = useState<readonly PickedFile[]>([]);
  // The demo's stand-in for an upload: one timer per file, cleared when the file is removed.
  const uploads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const pending = uploads.current;
    const urls = previews.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function add(list: FileList | null): void {
    const picked = [...(list ?? [])].map((file): PickedFile => {
      const id = crypto.randomUUID();
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (previewUrl !== undefined) previews.current.add(previewUrl);
      uploads.current.set(
        id,
        setTimeout(() => {
          uploads.current.delete(id);
          setFiles((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, state: "done" } : entry))
          );
        }, UPLOAD_MS)
      );
      return { id, name: file.name, size: formatSize(file.size), previewUrl, state: "uploading" };
    });
    setFiles((current) => [...current, ...picked]);
  }

  function remove(file: PickedFile): void {
    clearTimeout(uploads.current.get(file.id));
    uploads.current.delete(file.id);
    if (file.previewUrl !== undefined) {
      URL.revokeObjectURL(file.previewUrl);
      previews.current.delete(file.previewUrl);
    }
    setFiles((current) => current.filter((entry) => entry.id !== file.id));
  }

  return (
    <div className="max-w-md flex w-full flex-col items-start gap-3">
      <FileTrigger
        acceptedFileTypes={["image/png", "image/jpeg", "image/webp", ".pdf"]}
        allowsMultiple
        onSelect={add}>
        Attach files
      </FileTrigger>
      {files.length > 0 ? (
        <Attachment.Group aria-label="Attached files" className="w-full">
          {files.map((file) => (
            <Attachment.Root key={file.id} state={file.state}>
              {file.previewUrl === undefined ? (
                <Attachment.Media>
                  {file.state === "uploading" ? <SpinnerGap className="animate-spin" /> : <Files />}
                </Attachment.Media>
              ) : (
                <Attachment.Media variant="image">
                  <img src={file.previewUrl} alt={file.name} />
                </Attachment.Media>
              )}
              <Attachment.Content>
                <Attachment.Title>{file.name}</Attachment.Title>
                <Attachment.Description>
                  {file.state === "uploading" ? `Uploading · ${file.size}` : `Uploaded · ${file.size}`}
                </Attachment.Description>
              </Attachment.Content>
              <Attachment.Actions>
                <Attachment.Action
                  aria-label={`Remove ${file.name}`}
                  onClick={() => {
                    remove(file);
                  }}>
                  <X />
                </Attachment.Action>
              </Attachment.Actions>
            </Attachment.Root>
          ))}
        </Attachment.Group>
      ) : null}
    </div>
  );
}
