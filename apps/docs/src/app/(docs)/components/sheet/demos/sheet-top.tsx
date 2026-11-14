"use client";

import { Sheet } from "@elmeragroup/fuse/sheet";

export function SheetTop() {
  return (
    <Sheet.Root side="top">
      <Sheet.Trigger>Open meter details</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Meter details</Sheet.Title>
          <Sheet.Description>Readings and contract data for this address.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>
          <p>Last reading 12 480 kWh. Next scheduled read is 1 September.</p>
        </Sheet.Body>
      </Sheet.Content>
    </Sheet.Root>
  );
}
