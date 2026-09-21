"use client";

import { Empty } from "@elmeragroup/fuse/empty";
import { Tray } from "@elmeragroup/fuse/icons";

export function EmptyInlineLink() {
  return (
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon">
          <Tray aria-hidden />
        </Empty.Media>
        <Empty.Title>No orders yet</Empty.Title>
        <Empty.Description>
          Orders you create will show up here. Read the <a href="/quick-start">quick-start guide</a> to get
          started.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  );
}
