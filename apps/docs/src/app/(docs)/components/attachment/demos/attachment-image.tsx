"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Download, X } from "@elmeragroup/fuse/icons";

export function AttachmentImage() {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Attachment.Root orientation="vertical">
        <Attachment.Media variant="image">
          <img src="/landing/sites/tkas/usage.webp" alt="An open-plan kitchen and living room" />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>living-room.webp</Attachment.Title>
          <Attachment.Description>WEBP · 24 KB</Attachment.Description>
        </Attachment.Content>
        <Attachment.Actions>
          <Attachment.Action aria-label="Download living-room.webp">
            <Download />
          </Attachment.Action>
          <Attachment.Action aria-label="Remove living-room.webp">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
      <Attachment.Root orientation="vertical">
        <Attachment.Media variant="image">
          <Attachment.AspectRatio ratio="3:4">
            <img
              className="size-full object-cover"
              src="/landing/sites/fkse/market.webp"
              alt="A woman smelling a branch of cherry blossom"
            />
          </Attachment.AspectRatio>
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>blossom.webp</Attachment.Title>
          <Attachment.Description>WEBP · 210 KB</Attachment.Description>
        </Attachment.Content>
        <Attachment.Actions>
          <Attachment.Action aria-label="Remove blossom.webp">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
      <Attachment.Root>
        <Attachment.Media variant="image">
          <img
            src="/landing/sites/fkas/renovated.webp"
            alt="Two people looking up at the beams of an attic"
          />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>attic.webp</Attachment.Title>
          <Attachment.Description>WEBP · 64 KB</Attachment.Description>
        </Attachment.Content>
        <Attachment.Actions>
          <Attachment.Action aria-label="Remove attic.webp">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
    </div>
  );
}
