"use client";

import { Card } from "@elmeragroup/fuse/card";
import { House, Lightning } from "@elmeragroup/fuse/icons";

/**
 * A card split into stacked sections of equal weight. Each section pads with the card's tier, a
 * line runs between them from edge to edge, and a section with media centres its icon beside
 * the content.
 */
export function CardSections() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Section>
        <Card.SectionMedia>
          <House aria-hidden />
        </Card.SectionMedia>
        <div>
          <Card.Title size="default" level={2}>
            12 Example Street
          </Card.Title>
          <Card.Description>1234 Sampletown</Card.Description>
        </div>
      </Card.Section>
      <Card.Section>
        <Card.SectionMedia>
          <Lightning aria-hidden />
        </Card.SectionMedia>
        <div>
          <Card.Title size="default" level={2}>
            Spot price
          </Card.Title>
          <Card.Description>Hourly price with no lock-in.</Card.Description>
        </div>
      </Card.Section>
      <Card.Section>
        <p>Moving out on 1 November.</p>
      </Card.Section>
    </Card.Root>
  );
}
