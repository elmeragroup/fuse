"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardSectionLink() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Section>
        <Card.Title size="default">Spot price</Card.Title>
        <Card.Description>Hourly price with no lock-in.</Card.Description>
      </Card.Section>
      <Card.SectionButton render={<a href="#terms" />}>Read the terms</Card.SectionButton>
    </Card.Root>
  );
}
