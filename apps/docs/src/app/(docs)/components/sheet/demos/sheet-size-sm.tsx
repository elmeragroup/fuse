"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Sheet } from "@elmeragroup/fuse/sheet";

export function SheetSizeSm() {
  return (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="outline" />}>Compare tariffs</Sheet.Trigger>
      <Sheet.Content size="sm">
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
