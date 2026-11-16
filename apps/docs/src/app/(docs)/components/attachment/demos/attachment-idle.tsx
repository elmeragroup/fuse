"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { ClockCounterClockwise, X } from "@elmeragroup/fuse/icons";

export function AttachmentIdle() {
  return (
    <Attachment.Root state="idle">
      <Attachment.Media>
        <ClockCounterClockwise />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>floor-plan.pdf</Attachment.Title>
        <Attachment.Description>Ready to upload</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Remove floor-plan.pdf">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
