"use client";

import { useRef } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Dialog } from "@elmeragroup/ui/dialog";

const clauses = Array.from({ length: 24 }, (_, index) => index + 1);

export function DialogScrolling() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button variant="outline" />}>Open the full terms</Dialog.Trigger>
      <Dialog.Content size="lg" initialFocus={titleRef}>
        <Dialog.Header>
          <Dialog.Title ref={titleRef} tabIndex={-1}>
            Full terms
          </Dialog.Title>
          <Dialog.Description>
            The popup caps its height and scrolls its own content instead of the page.
          </Dialog.Description>
        </Dialog.Header>
        <div className="flex flex-col gap-4">
          {clauses.map((clause) => (
            <p key={clause}>
              Clause {clause}. Delivery, metering, invoicing, and notice periods follow the standard agreement
              for household customers.
            </p>
          ))}
        </div>
        <Dialog.Footer showCloseButton />
      </Dialog.Content>
    </Dialog.Root>
  );
}
