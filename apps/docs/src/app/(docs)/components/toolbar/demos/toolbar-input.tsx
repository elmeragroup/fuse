"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarInput() {
  return (
    <Toolbar.Root aria-label="Messages">
      <Toolbar.Button>Mark all read</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Input aria-label="Search messages" placeholder="Search" />
    </Toolbar.Root>
  );
}
