"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardAction() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title>Invoice 4821</Card.Title>
        <Card.Description>Due on 12 April.</Card.Description>
        <Card.Action>
          <a href="#invoice-4821">View</a>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <p>NOK 2 310,00</p>
      </Card.Content>
    </Card.Root>
  );
}
