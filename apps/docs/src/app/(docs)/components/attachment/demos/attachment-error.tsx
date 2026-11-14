"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { ArrowsClockwise, WarningCircle, X } from "@elmeragroup/fuse/icons";

export function AttachmentError() {
  return (
    <Attachment.Root state="error">
      <Attachment.Media>
        <WarningCircle />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>contract-scan.pdf</Attachment.Title>
        <Attachment.Description>Upload failed. The file is over 10 MB.</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Retry the upload of contract-scan.pdf">
          <ArrowsClockwise />
        </Attachment.Action>
        <Attachment.Action aria-label="Remove contract-scan.pdf">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
