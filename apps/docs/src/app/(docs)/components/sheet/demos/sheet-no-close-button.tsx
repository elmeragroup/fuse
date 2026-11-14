"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Sheet } from "@elmeragroup/fuse/sheet";

export function SheetNoCloseButton() {
  return (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="outline" />}>Read the terms</Sheet.Trigger>
      <Sheet.Content showCloseButton={false}>
        <Sheet.Header>
          <Sheet.Title>Terms for the fixed price</Sheet.Title>
          <Sheet.Description>The price is fixed for 12 months from the start date.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Footer>
          <Sheet.Close render={<Button variant="outline" />}>I have read the terms</Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}
