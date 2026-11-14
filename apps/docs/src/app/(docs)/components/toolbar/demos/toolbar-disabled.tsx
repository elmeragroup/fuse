"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarDisabled() {
  return (
    <Toolbar.Root aria-label="Invoice" disabled>
      <Toolbar.Button>Download</Toolbar.Button>
      <Toolbar.Button>Duplicate</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Button>Delete</Toolbar.Button>
    </Toolbar.Root>
  );
}
