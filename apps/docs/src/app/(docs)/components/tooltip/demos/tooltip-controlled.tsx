"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function TooltipControlled() {
  const [open, setOpen] = useState(true);

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger render={<Button variant="outline" />}>Grid rent</Tooltip.Trigger>
      <Tooltip.Content>The fee for using the electricity grid</Tooltip.Content>
    </Tooltip.Root>
  );
}
