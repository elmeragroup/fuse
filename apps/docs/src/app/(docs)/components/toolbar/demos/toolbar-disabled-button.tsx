"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarDisabledButton() {
  return (
    <Toolbar.Root aria-label="Invoice">
      <Toolbar.Button>Download</Toolbar.Button>
      <Toolbar.Button>Duplicate</Toolbar.Button>
      <Toolbar.Button disabled>Delete</Toolbar.Button>
    </Toolbar.Root>
  );
}
