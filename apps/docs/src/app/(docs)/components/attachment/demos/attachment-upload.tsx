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
};

/** How long the demo pretends an upload takes. */
const UPLOAD_MS = 1500;

function formatSize(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** One picked file. Its timer is the demo's stand-in for an upload, and removing the file clears it. */
function UploadingFile({ file, onRemove }: { file: PickedFile; onRemove: () => void }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDone(true);
    }, UPLOAD_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <Attachment.Root state={done ? "done" : "uploading"}>
      {file.previewUrl === undefined ? (
        <Attachment.Media>{done ? <Files /> : <SpinnerGap className="animate-spin" />}</Attachment.Media>
      ) : (
        <Attachment.Media variant="image">
          <img src={file.previewUrl} alt={file.name} />
        </Attachment.Media>
      )}
      <Attachment.Content>
        <Attachment.Title>{file.name}</Attachment.Title>
        <Attachment.Description>
          {done ? `Uploaded · ${file.size}` : `Uploading · ${file.size}`}
        </Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label={`Remove ${file.name}`} onClick={onRemove}>
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}

export function AttachmentUpload() {
  const [files, setFiles] = useState<readonly PickedFile[]>([]);
  // The parent revokes the previews. A revoke in a row's effect would run under StrictMode's
  // double mount and break a preview that is still on screen.
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function add(list: FileList | null): void {
    const picked = [...(list ?? [])].map((file): PickedFile => {
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (previewUrl !== undefined) previews.current.add(previewUrl);
      return { id: crypto.randomUUID(), name: file.name, size: formatSize(file.size), previewUrl };
    });
    setFiles((current) => [...current, ...picked]);
  }

  function remove(file: PickedFile): void {
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
            <UploadingFile
              key={file.id}
              file={file}
              onRemove={() => {
                remove(file);
              }}
            />
          ))}
        </Attachment.Group>
      ) : null}
    </div>
  );
}
