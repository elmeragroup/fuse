"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";

/** Previews a disposable invoice export without downloading customer data. */
export function CardWithAction() {
  const [exported, setExported] = useState(false);
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Invoice 4821</Card.Title>
        <Card.Description>Due 12 April.</Card.Description>
        <Card.Action>
          <Button size="sm" variant="outline" onClick={() => setExported(true)}>
            Export
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <p>NOK 2 310,00</p>
        <p role="status">{exported ? "Demo export ready: invoice 4821, NOK 2 310,00." : ""}</p>
      </Card.Content>
      {exported ? (
        <Card.Footer>
          <Button size="sm" variant="outline" onClick={() => setExported(false)}>
            Reset export
          </Button>
        </Card.Footer>
      ) : null}
    </Card.Root>
  );
}
