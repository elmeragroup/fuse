"use client";

import { Card } from "@elmeragroup/fuse/card";
import { House, Lightning } from "@elmeragroup/fuse/icons";

export function CardSectionMedia() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Section>
        <Card.SectionMedia>
          <House aria-hidden />
        </Card.SectionMedia>
        <Card.Content>
          <Card.Title size="default">12 Example Street</Card.Title>
          <Card.Description>1234 Sampletown</Card.Description>
        </Card.Content>
      </Card.Section>
      <Card.Section>
        <Card.SectionMedia>
          <Lightning aria-hidden />
        </Card.SectionMedia>
        <Card.Content>
          <Card.Title size="default">Spot price</Card.Title>
          <Card.Description>Hourly price with no lock-in.</Card.Description>
        </Card.Content>
      </Card.Section>
    </Card.Root>
  );
}
