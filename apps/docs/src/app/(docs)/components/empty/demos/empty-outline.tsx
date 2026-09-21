"use client";

import { Empty } from "@elmeragroup/fuse/empty";
import { Tray } from "@elmeragroup/fuse/icons";

export function EmptyOutline() {
  return (
    <div className="md:grid-cols-2 grid gap-6">
      <Empty.Root variant="outline">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Tray aria-hidden />
          </Empty.Media>
          <Empty.Title>No orders yet</Empty.Title>
          <Empty.Description>Outline frame.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
      <Empty.Root variant="outline-dashed">
        <Empty.Header>
          <Empty.Media variant="icon">
            <Tray aria-hidden />
          </Empty.Media>
          <Empty.Title>No orders yet</Empty.Title>
          <Empty.Description>Dashed outline frame.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    </div>
  );
}
