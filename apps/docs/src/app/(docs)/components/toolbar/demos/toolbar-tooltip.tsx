"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

export function ToolbarTooltip() {
  return (
    <Toolbar.Root aria-label="Layer">
      <Toolbar.Button>Duplicate</Toolbar.Button>
      <Tooltip.Root>
        <Tooltip.Trigger render={<Toolbar.Button />}>Lock</Tooltip.Trigger>
        <Tooltip.Content>Stop the layer from moving</Tooltip.Content>
      </Tooltip.Root>
    </Toolbar.Root>
  );
}
