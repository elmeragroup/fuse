"use client";

import { Card } from "@elmeragroup/fuse/card";

const ROWS = [
  ["Electricity", "NOK 1 840,00"],
  ["Grid rent", "NOK 412,50"],
  ["Monthly fee", "NOK 49,00"],
] as const;

/**
 * A default card pads with the large surface tier. A small card pads with the medium tier, so a
 * card of label and value rows lines up with the Items and Accordion items around it.
 */
export function CardSizes() {
  return (
    <div className="max-w-md flex w-full flex-col gap-4">
      <Card.Root>
        <Card.Header>
          <Card.Title size="lg">March usage</Card.Title>
          <Card.Description>Estimated consumption for the period.</Card.Description>
        </Card.Header>
        <Card.Content>
          <p>1 240 kWh across two meters.</p>
        </Card.Content>
      </Card.Root>
      <Card.Root size="sm">
        <Card.Header>
          <Card.Title size="lg">Order summary</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl className="text-sm flex flex-col gap-2">
            {ROWS.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card.Content>
      </Card.Root>
    </div>
  );
}
