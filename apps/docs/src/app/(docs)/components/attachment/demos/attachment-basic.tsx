"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { FileArrowUp, X } from "@elmeragroup/fuse/icons";

export function AttachmentBasic() {
  return (
    <Attachment.Root>
      <Attachment.Media>
        <FileArrowUp />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>meter-readings.pdf</Attachment.Title>
        <Attachment.Description>PDF · 240 KB</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Remove meter-readings.pdf">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
