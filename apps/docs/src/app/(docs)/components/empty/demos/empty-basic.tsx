"use client";

import { Empty } from "@elmeragroup/fuse/empty";
import { Tray } from "@elmeragroup/fuse/icons";

export function EmptyBasic() {
  return (
    <Empty.Root>
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
