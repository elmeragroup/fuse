"use client";

import { Card } from "@elmeragroup/fuse/card";

/** A card with no header: its content pads every side with the card's tier. */
export function CardContentOnly() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Content>
        <p>Your order is saved. We will email you a confirmation.</p>
      </Card.Content>
    </Card.Root>
  );
}
