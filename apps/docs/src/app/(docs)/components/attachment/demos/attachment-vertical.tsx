"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Download, X } from "@elmeragroup/fuse/icons";

export function AttachmentVertical() {
  return (
    <Attachment.Root orientation="vertical">
      <Attachment.Media variant="image">
        <img
          src="/demos/photos/colleagues.webp"
          alt="Two colleagues smiling at a laptop on a shared desk"
          loading="lazy"
          decoding="async"
        />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>colleagues.webp</Attachment.Title>
        <Attachment.Description>WEBP · 17 KB</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Download colleagues.webp">
          <Download />
        </Attachment.Action>
        <Attachment.Action aria-label="Remove colleagues.webp">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
