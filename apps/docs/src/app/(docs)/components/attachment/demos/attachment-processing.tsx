"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Files, X } from "@elmeragroup/fuse/icons";

export function AttachmentProcessing() {
  return (
    <Attachment.Root state="processing">
      <Attachment.Media>
        <Files />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>yearly-usage.csv</Attachment.Title>
        <Attachment.Description>Checking the readings</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Remove yearly-usage.csv">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
