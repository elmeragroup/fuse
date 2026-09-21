"use client";

import { Card } from "@elmeragroup/fuse/card";
import { Loader } from "@elmeragroup/fuse/loader";
import { Text } from "@elmeragroup/fuse/text";

export function LoaderInline() {
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Meter reading</Card.Title>
        <Card.Description>Latest consumption is still arriving.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col items-center">
        <Loader size="medium" aria-label="Laster" />
        <Text size="sm" variant="muted">
          Fetching the latest reading.
        </Text>
      </Card.Content>
    </Card.Root>
  );
}
