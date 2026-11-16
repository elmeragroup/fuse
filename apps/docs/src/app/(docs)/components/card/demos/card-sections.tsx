"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardSections() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title size="lg" level={2}>
          Your order
        </Card.Title>
      </Card.Header>
      <Card.Section>
        <p>Spot price, hourly with no lock-in.</p>
      </Card.Section>
      <Card.Section>
        <p>Delivered to Storgata 1, 0155 Oslo.</p>
      </Card.Section>
      <Card.Section>
        <p>Moving out on 1 November.</p>
      </Card.Section>
    </Card.Root>
  );
}
