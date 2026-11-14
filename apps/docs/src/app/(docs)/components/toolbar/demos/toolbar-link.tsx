"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarLink() {
  return (
    <Toolbar.Root aria-label="Messages">
      <Toolbar.Button>Mark all read</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Link href="#help">Help</Toolbar.Link>
    </Toolbar.Root>
  );
}
