"use client";

import { Card } from "@elmeragroup/fuse/card";
import { House, Lightning } from "@elmeragroup/fuse/icons";

/**
 * A card whose body is stacked sections of equal weight under a header. Each section pads with
 * the card's tier, a line runs between the parts from edge to edge, and a section with media
 * centres its icon beside its `Card.Content` column.
 */
export function CardSections() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title size="lg" level={2}>
          Your order
        </Card.Title>
      </Card.Header>
      <Card.Section>
        <Card.SectionMedia>
          <House aria-hidden />
        </Card.SectionMedia>
        <Card.Content>
          <Card.Title size="default" level={3}>
            12 Example Street
          </Card.Title>
          <Card.Description>1234 Sampletown</Card.Description>
        </Card.Content>
      </Card.Section>
      <Card.Section>
        <Card.SectionMedia>
          <Lightning aria-hidden />
        </Card.SectionMedia>
        <Card.Content>
          <Card.Title size="default" level={3}>
            Spot price
          </Card.Title>
          <Card.Description>Hourly price with no lock-in.</Card.Description>
        </Card.Content>
      </Card.Section>
      <Card.Section>
        <p>Moving out on 1 November.</p>
      </Card.Section>
    </Card.Root>
  );
}
