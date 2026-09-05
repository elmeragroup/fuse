"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Collapsible } from "@elmeragroup/ui/collapsible";

export function CollapsibleControlled() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide details" : "Show details"}
      </Button>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="font-medium rounded-md px-2 py-1 hover:bg-foreground/5">
          Toggle panel
        </Collapsible.Trigger>
        <Collapsible.Content className="h-0 overflow-hidden transition-[height] data-open:h-(--collapsible-panel-height)">
          <p className="pt-2">Controlled from the button above and from the trigger.</p>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
