"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { X } from "@elmeragroup/fuse/icons";

export function AttachmentImage() {
  return (
    <Attachment.Root>
      <Attachment.Media variant="image">
        <img
          src="/demos/photos/stairwell.webp"
          alt="Two people talking on a stairwell, seen from above"
          loading="lazy"
          decoding="async"
        />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>stairwell.webp</Attachment.Title>
        <Attachment.Description>WEBP · 21 KB</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Remove stairwell.webp">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
