"use client";

import { Sheet } from "@elmeragroup/fuse/sheet";

const clauses = Array.from({ length: 24 }, (_, index) => index + 1);

export function SheetScrolling() {
  return (
    <Sheet.Root>
      <Sheet.Trigger>Open the full terms</Sheet.Trigger>
      <Sheet.Content>
        <Sheet.Header>
          <Sheet.Title>Full terms</Sheet.Title>
          <Sheet.Description>The standard agreement for household customers.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>
          {clauses.map((clause) => (
            <p key={clause}>
              Clause {clause}. Delivery, metering, invoicing and notice periods follow the standard agreement
              for household customers.
            </p>
          ))}
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close>Close</Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}
