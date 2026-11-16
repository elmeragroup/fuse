"use client";

import { Empty } from "@elmeragroup/fuse/empty";
import { Tray } from "@elmeragroup/fuse/icons";

export function EmptyOutlineDashed() {
  return (
    <Empty.Root variant="outline-dashed">
      <Empty.Header>
        <Empty.Media variant="icon">
          <Tray aria-hidden />
        </Empty.Media>
        <Empty.Title>No orders yet</Empty.Title>
        <Empty.Description>Orders you create will show up here.</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  );
}
