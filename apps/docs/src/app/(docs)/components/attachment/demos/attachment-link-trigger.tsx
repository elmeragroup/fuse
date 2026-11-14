"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { X } from "@elmeragroup/fuse/icons";

const MEETING_PHOTO = "/demos/photos/meeting.webp";

export function AttachmentLinkTrigger() {
  return (
    <Attachment.Root>
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
  );
}
