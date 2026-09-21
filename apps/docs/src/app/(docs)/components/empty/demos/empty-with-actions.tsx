"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Empty } from "@elmeragroup/fuse/empty";
import { Tray } from "@elmeragroup/fuse/icons";

/** Replaces the empty state with local sample orders and supports reset. */
export function EmptyWithActions() {
  const [orders, setOrders] = useState<string[]>([]);
  if (orders.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status">
          {orders.length} sample {orders.length === 1 ? "order" : "orders"} added.
        </p>
        <ul>
          {orders.map((order) => (
            <li key={order}>{order}</li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="self-start" onClick={() => setOrders([])}>
          Reset example
        </Button>
      </div>
    );
  }
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
        <Button onClick={() => setOrders(["Sample order 1001"])}>Create order</Button>
        <Button variant="secondary" onClick={() => setOrders(["Sample order 1001", "Sample order 1002"])}>
          Import orders
        </Button>
      </Empty.Content>
    </Empty.Root>
  );
}
