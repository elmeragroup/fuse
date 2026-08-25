"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { Tooltip } from "@elmeragroup/ui/tooltip";

export function TooltipControlled() {
  const [open, setOpen] = useState(true);

  return (
    <Tooltip.Provider>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger render={<Button variant="outline" />}>Hint</Tooltip.Trigger>
        <Tooltip.Content>Add to library</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
