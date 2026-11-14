"use client";

import { useRef } from "react";

import { Dialog } from "@elmeragroup/fuse/dialog";

const clauses = Array.from({ length: 24 }, (_, index) => index + 1);

export function DialogScrolling() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog.Root>
      <Dialog.Trigger>Open the full terms</Dialog.Trigger>
      <Dialog.Content initialFocus={titleRef}>
        <Dialog.Header>
          <Dialog.Title ref={titleRef} isFocusable>
            Full terms
          </Dialog.Title>
          <Dialog.Description>The standard agreement for household customers.</Dialog.Description>
        </Dialog.Header>
        <div className="flex flex-col gap-4">
          {clauses.map((clause) => (
            <p key={clause}>
              Clause {clause}. Delivery, metering, invoicing and notice periods follow the standard agreement
              for household customers.
            </p>
          ))}
        </div>
        <Dialog.Footer showCloseButton />
      </Dialog.Content>
    </Dialog.Root>
  );
}
