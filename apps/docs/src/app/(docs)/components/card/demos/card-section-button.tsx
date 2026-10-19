"use client";

import { useState } from "react";

import { Card } from "@elmeragroup/fuse/card";
import { CaretRight } from "@elmeragroup/fuse/icons";

/** A whole section as a button, with a trailing caret. It takes a hover fill and a focus ring. */
export function CardSectionButton() {
  const [declined, setDeclined] = useState(false);
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Section>
        <Card.Title size="default" level={2}>
          Home insurance
        </Card.Title>
        <Card.Description>Covers the contents of your home from NOK 99 a month.</Card.Description>
      </Card.Section>
      <Card.Section
        render={<button type="button" onClick={() => setDeclined(true)} />}
        className="flex items-center justify-between gap-3">
        No thanks, continue without
        <CaretRight aria-hidden className="size-4 shrink-0" />
      </Card.Section>
      <Card.Section>
        <p role="status">
          {declined ? "Continuing without home insurance." : "You can add it later from your account."}
        </p>
      </Card.Section>
    </Card.Root>
  );
}
