"use client";

import { useState } from "react";

import { Collapsible } from "@elmeragroup/fuse/collapsible";

export function CollapsibleControlled() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide details" : "Show details"}
      </button>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="font-medium rounded-md px-2 py-1 hover:bg-foreground/5">
          Toggle panel
        </Collapsible.Trigger>
        <Collapsible.Content>
          <p className="pt-2">The button above and the trigger both open this panel.</p>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
