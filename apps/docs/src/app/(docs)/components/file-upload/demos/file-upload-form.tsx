"use client";

import { useState } from "react";

import { FileUpload } from "@elmeragroup/fuse/file-upload";

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
  const [files, setFiles] = useState<readonly File[]>(() => [
    new File(["%PDF-1.7"], "receipt-0412.pdf", { type: "application/pdf" }),
  ]);
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
          <FileUpload.Trigger>Add receipts</FileUpload.Trigger>
          <FileUpload.Description>Images or PDFs.</FileUpload.Description>
        </FileUpload.Dropzone>
        {files.length > 0 ? (
          <ul aria-label="Receipts to send" className="text-sm flex w-full flex-col gap-1">
            {files.map((file, index) => (
              <li key={`${index}-${file.name}`} className="flex items-center justify-between gap-2">
                {file.name}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, kept) => kept !== index))}
                  className="text-muted-foreground underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </FileUpload.Root>
      <button type="submit" className="text-sm self-start rounded-md border border-input px-3 py-1.5">
        Send
      </button>
      {posted === null ? null : <output className="text-sm">The form posted {posted.join(", ")}.</output>}
    </form>
  );
}
