"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardContentOnly() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Content>
        <p>Your order is saved. We will email you a confirmation.</p>
      </Card.Content>
    </Card.Root>
  );
}
