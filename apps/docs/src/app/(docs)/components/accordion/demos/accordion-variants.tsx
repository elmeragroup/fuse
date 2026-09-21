"use client";

import { Accordion } from "@elmeragroup/fuse/accordion";

function Sample({
  variant,
  radius,
}: {
  variant: "default" | "card" | "infodropdown";
  radius?: "none" | "lg" | "xl";
}) {
  return (
    <Accordion.Root variant={variant} radius={radius} defaultValue={["shipping"]}>
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
    </Accordion.Root>
  );
}

export function AccordionVariants() {
  return (
    <div className="flex flex-col gap-8">
      <Sample variant="default" />
      <Sample variant="card" radius="lg" />
      <Sample variant="card" radius="xl" />
      <Sample variant="infodropdown" />
    </div>
  );
}
