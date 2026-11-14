"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarDemo() {
  return (
    <Toolbar.Root aria-label="Invoice">
      <Toolbar.Group aria-label="File">
        <Toolbar.Button>Download</Toolbar.Button>
        <Toolbar.Button>Duplicate</Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Button>Delete</Toolbar.Button>
    </Toolbar.Root>
  );
}
