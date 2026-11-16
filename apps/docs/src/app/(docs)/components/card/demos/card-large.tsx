"use client";

import { Card } from "@elmeragroup/fuse/card";

export function CardLarge() {
  return (
    <Card.Root size="lg" className="max-w-md w-full">
      <Card.Header>
        <Card.Title size="lg">About spot pricing</Card.Title>
      </Card.Header>
      <Card.Content>
        <p>
          Spot follows the hourly market price plus a fixed markup. You pay less when demand is low and more
          at peak hours, so moving laundry and charging to the night lowers the bill.
        </p>
      </Card.Content>
    </Card.Root>
  );
}
