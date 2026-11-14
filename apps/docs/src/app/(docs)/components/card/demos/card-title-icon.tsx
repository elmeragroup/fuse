"use client";

import { Card } from "@elmeragroup/fuse/card";
import { Lightning } from "@elmeragroup/fuse/icons";

export function CardTitleIcon() {
  return (
    <Card.Root className="max-w-md w-full">
      <Card.Header>
        <Card.Title icon={<Lightning aria-hidden />}>March usage</Card.Title>
        <Card.Description>Estimated consumption for the period.</Card.Description>
      </Card.Header>
    </Card.Root>
  );
}
