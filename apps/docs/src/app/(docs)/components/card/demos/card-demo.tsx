"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardDemo() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title>March usage</Card.Title>
        <Card.Description>Estimated consumption for the period.</Card.Description>
      </Card.Header>
      <Card.Content>
        <p>1 240 kWh across two meters.</p>
      </Card.Content>
      <Card.Footer>
        <p>Settled on 3 April.</p>
      </Card.Footer>
    </Card.Root>
  );
}
