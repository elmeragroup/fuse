"use client";

import { Collapsible } from "@elmeragroup/fuse/collapsible";

export function CollapsibleDisabled() {
  return (
    <Collapsible.Root disabled>
      <Collapsible.Trigger className="font-medium rounded-md px-2 py-1 hover:bg-foreground/5">
        Show details
      </Collapsible.Trigger>
      <Collapsible.Content>
        <p className="pt-2">Details are locked while the order ships.</p>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
