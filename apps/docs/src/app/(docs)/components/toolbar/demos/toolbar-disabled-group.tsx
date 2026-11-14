"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarDisabledGroup() {
  return (
    <Toolbar.Root aria-label="Invoice">
      <Toolbar.Group aria-label="File">
        <Toolbar.Button>Download</Toolbar.Button>
        <Toolbar.Button>Duplicate</Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Group aria-label="Status" disabled>
        <Toolbar.Button>Mark paid</Toolbar.Button>
        <Toolbar.Button>Cancel</Toolbar.Button>
      </Toolbar.Group>
    </Toolbar.Root>
  );
}
