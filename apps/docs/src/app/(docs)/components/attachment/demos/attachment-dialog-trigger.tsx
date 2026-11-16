"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { Copy, FileMagnifyingGlass, X } from "@elmeragroup/fuse/icons";

export function AttachmentDialogTrigger() {
  return (
    <Dialog.Root>
      <Attachment.Root>
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
  );
}
