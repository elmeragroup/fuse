"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { Copy, FileMagnifyingGlass, X } from "@elmeragroup/fuse/icons";

const ATTIC_PHOTO = "/landing/sites/fkas/renovated.webp";

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
          <img
            src={ATTIC_PHOTO}
            alt="Two people looking up at the beams of an attic"
            loading="lazy"
            decoding="async"
          />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>attic.webp</Attachment.Title>
          <Attachment.Description>Opens in a new tab</Attachment.Description>
        </Attachment.Content>
        <Attachment.Trigger
          aria-label="Open attic.webp in a new tab"
          render={<a href={ATTIC_PHOTO} target="_blank" rel="noreferrer" />}
        />
        <Attachment.Actions>
          <Attachment.Action aria-label="Remove attic.webp">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
    </div>
  );
}
