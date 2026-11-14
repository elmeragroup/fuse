"use client";

import { Empty } from "@elmeragroup/fuse/empty";
import { FkasMeter } from "@elmeragroup/fuse/illustrations";

export function EmptyIllustration() {
  return (
    <Empty.Root>
      <Empty.Header>
        <Empty.Media>
          <FkasMeter className="h-24 w-auto" title="Meter" />
        </Empty.Media>
        <Empty.Title>No readings yet</Empty.Title>
        <Empty.Description>Readings from your meter will show up here.</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  );
}
