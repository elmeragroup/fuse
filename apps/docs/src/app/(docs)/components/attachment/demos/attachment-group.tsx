"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import { Files, X } from "@elmeragroup/fuse/icons";

type SharedFile = {
  readonly name: string;
  readonly meta: string;
  readonly image?: { readonly src: string; readonly alt: string };
};

const FILES: readonly SharedFile[] = [
  { name: "lease-agreement.pdf", meta: "PDF · 1.4 MB" },
  {
    name: "living-room.webp",
    meta: "WEBP · 24 KB",
    image: { src: "/landing/sites/tkas/usage.webp", alt: "An open-plan kitchen and living room" },
  },
  { name: "meter-readings.csv", meta: "CSV · 18 KB" },
  {
    name: "kitchen.webp",
    meta: "WEBP · 52 KB",
    image: { src: "/landing/sites/fkas/student.webp", alt: "Two people smiling in a kitchen" },
  },
  { name: "moving-notice.pdf", meta: "PDF · 220 KB" },
];

export function AttachmentGroupDemo() {
  return (
    <div className="max-w-md w-full">
      <Attachment.Group aria-label="Attached files">
        {FILES.map((file) => (
          <Attachment.Root key={file.name}>
            {file.image === undefined ? (
              <Attachment.Media>
                <Files />
              </Attachment.Media>
            ) : (
              <Attachment.Media variant="image">
                <img src={file.image.src} alt={file.image.alt} />
              </Attachment.Media>
            )}
            <Attachment.Content>
              <Attachment.Title>{file.name}</Attachment.Title>
              <Attachment.Description>{file.meta}</Attachment.Description>
            </Attachment.Content>
            <Attachment.Actions>
              <Attachment.Action aria-label={`Remove ${file.name}`}>
                <X />
              </Attachment.Action>
            </Attachment.Actions>
          </Attachment.Root>
        ))}
      </Attachment.Group>
    </div>
  );
}
