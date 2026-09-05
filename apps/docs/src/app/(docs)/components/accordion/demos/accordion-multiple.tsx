"use client";

import { Accordion } from "@elmeragroup/ui/accordion";

export function AccordionMultiple() {
  return (
    <Accordion.Root multiple defaultValue={["shipping", "returns"]}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Delivered within 3–5 business days.</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="billing">
        <Accordion.Header>
          <Accordion.Trigger>Billing</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Invoices are issued at the start of each month.</Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="returns">
        <Accordion.Header>
          <Accordion.Trigger>Returns</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Unused items can be returned within 30 days.</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
