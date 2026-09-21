"use client";

import { Card } from "@elmeragroup/fuse/card";
import { Lightning } from "@elmeragroup/fuse/icons";

export function CardTag() {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Tag>Invoice</Card.Tag>
        <Card.Title icon={<Lightning aria-hidden />}>March usage</Card.Title>
        <Card.Description>Estimated consumption for the period.</Card.Description>
      </Card.Header>
      <Card.Content>
        <p>Billed on the spot price plus the fixed markup.</p>
      </Card.Content>
    </Card.Root>
  );
}
