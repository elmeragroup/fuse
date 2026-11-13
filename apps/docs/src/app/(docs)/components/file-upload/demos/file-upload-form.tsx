"use client";

import { useState } from "react";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Button } from "@elmeragroup/fuse/button";
import { FileUpload } from "@elmeragroup/fuse/file-upload";
import { Files, Plus, X } from "@elmeragroup/fuse/icons";

/** What the form posted under `receipts`, as one line per file. */
function postedLines(data: FormData): string[] {
  return data
    .getAll("receipts")
    .flatMap((entry) =>
      entry instanceof File && entry.name !== "" ? [`${entry.name} (${entry.size} bytes)`] : []
    );
}

export function FileUploadForm() {
  // The form posts exactly this list, and `required` stops a submit while it is empty. FileUpload
  // hands each pick to onSelect, and the parent adds it.
  const [files, setFiles] = useState<readonly File[]>([]);
  const [posted, setPosted] = useState<readonly string[] | null>(null);

  return (
    <form
      className="max-w-md flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setPosted(postedLines(new FormData(event.currentTarget)));
      }}>
      <FileUpload.Root
        name="receipts"
        files={files}
        required
        accept="image/*,.pdf"
        multiple
        onSelect={(picked) => setFiles((current) => [...current, ...picked])}>
        <FileUpload.Dropzone>
          <FileUpload.Trigger render={<Button size="sm" />}>
            <Plus data-icon="inline-start" />
            Add receipts
          </FileUpload.Trigger>
          <FileUpload.Description>Images or PDFs.</FileUpload.Description>
        </FileUpload.Dropzone>
        {files.length > 0 ? (
          <Attachment.Group aria-label="Receipts to send" className="w-full">
            {files.map((file, index) => (
              <Attachment.Root key={`${index}-${file.name}`}>
                <Attachment.Media>
                  <Files />
                </Attachment.Media>
                <Attachment.Content>
                  <Attachment.Title>{file.name}</Attachment.Title>
                </Attachment.Content>
                <Attachment.Actions>
                  <Attachment.Action
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((_, kept) => kept !== index))}>
                    <X />
                  </Attachment.Action>
                </Attachment.Actions>
              </Attachment.Root>
            ))}
          </Attachment.Group>
        ) : null}
      </FileUpload.Root>
      <Button type="submit" variant="outline" className="self-start">
        Send
      </Button>
      {posted === null ? null : <output className="text-sm">The form posted {posted.join(", ")}.</output>}
    </form>
  );
}
