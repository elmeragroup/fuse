"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardTag() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Tag>Invoice</Card.Tag>
        <Card.Title>March usage</Card.Title>
        <Card.Description>Estimated consumption for the period.</Card.Description>
      </Card.Header>
    </Card.Root>
  );
}
