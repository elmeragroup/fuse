"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { X } from "@elmeragroup/fuse/icons";

export function AttachmentAspectRatio() {
  return (
    <Attachment.Root orientation="vertical">
      <Attachment.Media variant="image">
        <Attachment.AspectRatio ratio="3:4">
          <img
            className="size-full object-cover"
            src="/demos/photos/coffee-break.webp"
            alt="A woman holding a coffee cup"
            loading="lazy"
            decoding="async"
          />
        </Attachment.AspectRatio>
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>coffee-break.webp</Attachment.Title>
        <Attachment.Description>WEBP · 16 KB</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Remove coffee-break.webp">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
