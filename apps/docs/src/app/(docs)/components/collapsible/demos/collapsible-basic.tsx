"use client";

import { Collapsible } from "@elmeragroup/ui/collapsible";

export function CollapsibleBasic() {
  return (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger className="font-medium rounded-md px-2 py-1 hover:bg-foreground/5">
        Show details
      </Collapsible.Trigger>
      <Collapsible.Content>
        <p className="pt-2">Delivery window, meter point, and billing account.</p>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
