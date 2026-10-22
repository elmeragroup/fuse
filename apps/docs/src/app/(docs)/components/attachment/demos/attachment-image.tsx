"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Download, X } from "@elmeragroup/fuse/icons";

export function AttachmentImage() {
  return (
    <div className="flex flex-wrap items-start gap-4">
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
    </div>
  );
}
