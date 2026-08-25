"use client";

import { Collapsible } from "@elmeragroup/ui/collapsible";

export function CollapsibleHiddenUntilFound() {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger className="font-medium rounded-md px-2 py-1 hover:bg-foreground/5">
        Searchable details
      </Collapsible.Trigger>
      <Collapsible.Content
        hiddenUntilFound
        className="h-0 overflow-hidden transition-[height] data-open:h-(--collapsible-panel-height)">
        <p className="pt-2">Meter-reading reconciliation is due on 12 May.</p>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
