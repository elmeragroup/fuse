"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Sheet } from "@elmeragroup/fuse/sheet";

export function SheetBasic() {
  return (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="outline" />}>Open meter details</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Meter details</Sheet.Title>
          <Sheet.Description>Readings and contract data for this address.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>
          <p>Last reading 12 480 kWh. Next scheduled read is 1 September.</p>
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close render={<Button variant="outline" />}>Close</Sheet.Close>
          <Button>Save</Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}
