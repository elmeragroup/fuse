"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { SpinnerGap, X } from "@elmeragroup/fuse/icons";

export function AttachmentUploading() {
  return (
    <Attachment.Root state="uploading">
      <Attachment.Media>
        <SpinnerGap className="animate-spin" />
      </Attachment.Media>
      <Attachment.Content>
        <Attachment.Title>meter-photos.zip</Attachment.Title>
        <Attachment.Description>Uploading · 64%</Attachment.Description>
      </Attachment.Content>
      <Attachment.Actions>
        <Attachment.Action aria-label="Cancel the upload of meter-photos.zip">
          <X />
        </Attachment.Action>
      </Attachment.Actions>
    </Attachment.Root>
  );
}
