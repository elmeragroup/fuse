"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Sheet } from "@elmeragroup/fuse/sheet";

const clauses = Array.from({ length: 24 }, (_, index) => index + 1);

export function SheetScrolling() {
  return (
    <Sheet.Root>
      <Sheet.Trigger render={<Button variant="outline" />}>Open the full terms</Sheet.Trigger>
      <Sheet.Content size="lg">
        <Sheet.Header>
          <Sheet.Title>Full terms</Sheet.Title>
          <Sheet.Description>Header and footer stay pinned while the body scrolls.</Sheet.Description>
        </Sheet.Header>
        <Sheet.Body>
          {clauses.map((clause) => (
            <p key={clause}>
              Clause {clause}. Delivery, metering, invoicing, and notice periods follow the standard agreement
              for household customers.
            </p>
          ))}
        </Sheet.Body>
        <Sheet.Footer>
          <Sheet.Close render={<Button variant="outline" />}>Close</Sheet.Close>
          <Button>Accept</Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Root>
  );
}
