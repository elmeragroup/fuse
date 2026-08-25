"use client";

import { Button } from "@elmeragroup/ui/button";
import { Empty } from "@elmeragroup/ui/empty";
import { Tray } from "@elmeragroup/ui/icons";

export function EmptyWithActions() {
  return (
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon">
          <Tray aria-hidden />
        </Empty.Media>
        <Empty.Title>No orders yet</Empty.Title>
        <Empty.Description>Orders you create will show up here.</Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <Button>Create order</Button>
        <Button variant="secondary">Import orders</Button>
      </Empty.Content>
    </Empty.Root>
  );
}
