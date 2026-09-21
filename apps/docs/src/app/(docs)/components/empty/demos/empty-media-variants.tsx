"use client";

import { Empty } from "@elmeragroup/fuse/empty";
import { Tray } from "@elmeragroup/fuse/icons";
import { FkasMeter } from "@elmeragroup/fuse/illustrations";

export function EmptyMediaVariants() {
  return (
    <div className="md:grid-cols-2 grid gap-6">
      <Empty.Root>
        <Empty.Header>
          <Empty.Media>
            <FkasMeter className="h-24 w-auto" title="Meter" />
          </Empty.Media>
          <Empty.Title>No readings yet</Empty.Title>
          <Empty.Description>Default media is a frameless illustration box.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon">
            <Tray aria-hidden />
          </Empty.Media>
          <Empty.Title>No orders yet</Empty.Title>
          <Empty.Description>Icon media is a muted square.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    </div>
  );
}
