"use client";

import { Attachment } from "@elmeragroup/fuse/attachment";
import {
  ArrowsClockwise,
  CheckCircle,
  ClockCounterClockwise,
  Files,
  SpinnerGap,
  WarningCircle,
  X,
} from "@elmeragroup/fuse/icons";

export function AttachmentStates() {
  return (
    <div className="max-w-sm flex w-full flex-col gap-2">
      <Attachment.Root state="idle" className="w-full">
        <Attachment.Media>
          <ClockCounterClockwise />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>floor-plan.pdf</Attachment.Title>
          <Attachment.Description>Ready to upload</Attachment.Description>
        </Attachment.Content>
        <Attachment.Actions>
          <Attachment.Action aria-label="Remove floor-plan.pdf">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
      <Attachment.Root state="uploading" className="w-full">
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
      <Attachment.Root state="processing" className="w-full">
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
      <Attachment.Root state="error" className="w-full">
        <Attachment.Media>
          <WarningCircle />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>contract-scan.pdf</Attachment.Title>
          <Attachment.Description>Upload failed. The file is over 10 MB.</Attachment.Description>
        </Attachment.Content>
        <Attachment.Actions>
          <Attachment.Action aria-label="Retry the upload of contract-scan.pdf">
            <ArrowsClockwise />
          </Attachment.Action>
          <Attachment.Action aria-label="Remove contract-scan.pdf">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
      <Attachment.Root state="done" className="w-full">
        <Attachment.Media>
          <CheckCircle />
        </Attachment.Media>
        <Attachment.Content>
          <Attachment.Title>moving-notice.pdf</Attachment.Title>
          <Attachment.Description>Uploaded · 1.8 MB</Attachment.Description>
        </Attachment.Content>
        <Attachment.Actions>
          <Attachment.Action aria-label="Remove moving-notice.pdf">
            <X />
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
    </div>
  );
}
