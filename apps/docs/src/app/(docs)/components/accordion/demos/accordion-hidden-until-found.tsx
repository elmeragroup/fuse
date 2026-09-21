"use client";

import { Accordion } from "@elmeragroup/fuse/accordion";

export function AccordionHiddenUntilFound() {
  return (
    <Accordion.Root hiddenUntilFound>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Delivered within 3–5 business days.</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="warranty">
        <Accordion.Header>
          <Accordion.Trigger>Warranty</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          Closed panels stay searchable. Find-in-page can match the phrase “wolfram filament” and expand this
          item.
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
