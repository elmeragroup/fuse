"use client";

import { Collapsible } from "@elmeragroup/fuse/collapsible";
import { Frame } from "@elmeragroup/fuse/frame";
import { CaretDown } from "@elmeragroup/fuse/icons";

export function FrameCollapsiblePanels() {
  return (
    <Frame.Root className="max-w-md">
      <Collapsible.Root defaultOpen>
        <Frame.Header>
          <Collapsible.Trigger>
            Collect readings
            <CaretDown />
          </Collapsible.Trigger>
        </Frame.Header>
        <Collapsible.Content>
          <Frame.Panel>
            <p className="text-sm text-muted-foreground">
              Fetch the hourly readings for every meter in the billing run and flag the gaps to estimate.
            </p>
          </Frame.Panel>
        </Collapsible.Content>
      </Collapsible.Root>
      <Collapsible.Root>
        <Frame.Header>
          <Collapsible.Trigger>
            Calculate invoices
            <CaretDown />
          </Collapsible.Trigger>
        </Frame.Header>
        <Collapsible.Content>
          <Frame.Panel>
            <p className="text-sm text-muted-foreground">
              Price the readings with the spot price and grid rent, then draft one invoice per customer.
            </p>
          </Frame.Panel>
        </Collapsible.Content>
      </Collapsible.Root>
    </Frame.Root>
  );
}
