"use client";

import { Sheet } from "@elmeragroup/fuse/sheet";

export function SheetSize2xl() {
  return (
    <Sheet.Root>
      <Sheet.Trigger>Compare tariffs</Sheet.Trigger>
      <Sheet.Content size="2xl">
        <Sheet.Header>
          <Sheet.Title>Compare tariffs</Sheet.Title>
          <Sheet.Description>
            Fixed price, spot price and the variable tariff, side by side for your address.
          </Sheet.Description>
        </Sheet.Header>
      </Sheet.Content>
    </Sheet.Root>
  );
}
