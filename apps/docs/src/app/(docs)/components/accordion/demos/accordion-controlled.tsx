"use client";

import { useState } from "react";

import { Accordion } from "@elmeragroup/ui/accordion";
import { Button } from "@elmeragroup/ui/button";

const ALL = ["shipping", "billing", "returns"] as const;

export function AccordionControlled() {
  const [value, setValue] = useState<string[]>(["shipping"]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setValue([...ALL])}>
          Open all
        </Button>
        <Button type="button" variant="outline" onClick={() => setValue([])}>
          Close all
        </Button>
      </div>
      <Accordion.Root multiple value={value} onValueChange={setValue}>
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
    </div>
  );
}
