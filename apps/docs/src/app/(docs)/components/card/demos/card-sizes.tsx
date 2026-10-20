"use client";

import { Card } from "@elmeragroup/fuse/card";
import { Item } from "@elmeragroup/fuse/item";

const ROWS = [
  ["Electricity", "NOK 1 840,00"],
  ["Grid rent", "NOK 412,50"],
  ["Monthly fee", "NOK 49,00"],
] as const;

/**
 * A default card pads with the medium surface tier, as an Item does, so the text in a card of
 * label and value rows starts on the same edge as the Item above it. A large card pads with the
 * large tier, for long prose.
 */
export function CardSizes() {
  return (
    <div className="max-w-md flex w-full flex-col gap-4">
      <Item.Root variant="outline">
        <Item.Content>
          <Item.Title>Spot</Item.Title>
          <Item.Description>Hourly price with no lock-in.</Item.Description>
        </Item.Content>
      </Item.Root>
      <Card.Root>
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
      <Card.Root size="lg">
        <Card.Header>
          <Card.Title size="lg">About spot pricing</Card.Title>
        </Card.Header>
        <Card.Content>
          <p>
            Spot follows the hourly market price on Nord Pool, plus a fixed markup. You pay less when demand
            is low and more at peak hours, so moving laundry and charging to the night lowers the bill.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  );
}
