"use client";

import { Card } from "@elmeragroup/ui/card";

export function CardHorizontal() {
  return (
    <Card.Root direction="horizontal">
      <Card.Header direction="horizontal">
        <Card.Title direction="horizontal">Meter 707057500012345678</Card.Title>
        <Card.Description direction="horizontal">Storgata 1, 0155 Oslo.</Card.Description>
      </Card.Header>
      <Card.Content direction="horizontal">
        <p>Active since 1 January.</p>
      </Card.Content>
      <Card.Footer direction="horizontal">
        <p>Spot price</p>
      </Card.Footer>
    </Card.Root>
  );
}
