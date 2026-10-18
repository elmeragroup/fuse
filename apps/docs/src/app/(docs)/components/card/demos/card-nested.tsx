"use client";

import { Card } from "@elmeragroup/fuse/card";

/**
 * Cards on a card-coloured surface. External themes draw no card edge, so the inner cards have
 * no outline there; their headers and spacing carry the grouping. Each card's header is a size
 * container with no intrinsic width, so the outer card takes an explicit one.
 */
export function CardNested() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title>Your agreements</Card.Title>
        <Card.Description>Two products on one invoice.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        <Card.Root>
          <Card.Header>
            <Card.Title size="lg">Electricity</Card.Title>
            <Card.Description>Spot price, Storgata 1.</Card.Description>
          </Card.Header>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title size="lg">Mobile</Card.Title>
            <Card.Description>10 GB, no binding period.</Card.Description>
          </Card.Header>
        </Card.Root>
      </Card.Content>
    </Card.Root>
  );
}
