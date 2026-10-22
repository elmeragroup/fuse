"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { Copy, FileMagnifyingGlass, X } from "@elmeragroup/fuse/icons";

const MEETING_PHOTO = "/demos/photos/meeting.webp";

export function AttachmentTrigger() {
  return (
    <div className="max-w-sm flex w-full flex-col gap-2">
      <Dialog.Root>
        <Attachment.Root className="w-full">
          <Attachment.Media>
            <FileMagnifyingGlass />
          </Attachment.Media>
          <Attachment.Content>
            <Attachment.Title>inspection-report.pdf</Attachment.Title>
            <Attachment.Description>Opens a preview</Attachment.Description>
          </Attachment.Content>
          <Dialog.Trigger render={<Attachment.Trigger aria-label="Preview inspection-report.pdf" />} />
          <Attachment.Actions>
            <Attachment.Action aria-label="Copy link to inspection-report.pdf">
              <Copy />
            </Attachment.Action>
            <Attachment.Action aria-label="Remove inspection-report.pdf">
              <X />
            </Attachment.Action>
          </Attachment.Actions>
        </Attachment.Root>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>inspection-report.pdf</Dialog.Title>
            <Dialog.Description>PDF · 2.4 MB, added today.</Dialog.Description>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog.Root>
      <Attachment.Root className="w-full">
        <Attachment.Media variant="image">
          <img src={MEETING_PHOTO} alt="Two people talking at a café table" loading="lazy" decoding="async" />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>meeting.webp</Attachment.Title>
          <Attachment.Description>Opens in a new tab</Attachment.Description>
        </Attachment.Content>
        <Attachment.Trigger
          aria-label="Open meeting.webp in a new tab"
          render={<a href={MEETING_PHOTO} target="_blank" rel="noreferrer" />}
        />
        <Attachment.Actions>
          <Attachment.Action aria-label="Remove meeting.webp">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
    </div>
  );
}
