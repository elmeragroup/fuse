"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Files, X } from "@elmeragroup/fuse/icons";

const SIZES = ["default", "sm", "xs"] as const;

export function AttachmentSizes() {
  return (
    <div className="max-w-sm flex w-full flex-col gap-2">
      {SIZES.map((size) => (
        <Attachment.Root key={size} size={size} className="w-full">
          <Attachment.Media>
            <Files />
          </Attachment.Media>
          <Attachment.Content>
            <Attachment.Title>{`invoice-${size}.pdf`}</Attachment.Title>
            <Attachment.Description>{`size="${size}" · PDF · 96 KB`}</Attachment.Description>
          </Attachment.Content>
          <Attachment.Actions>
            <Attachment.Action aria-label={`Remove invoice-${size}.pdf`}>
              <X />
            </Attachment.Action>
          </Attachment.Actions>
        </Attachment.Root>
      ))}
    </div>
  );
}
