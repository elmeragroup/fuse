"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarInput() {
  return (
    <Toolbar.Root aria-label="Messages">
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Mark all read</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Input aria-label="Search messages" placeholder="Search" />
    </Toolbar.Root>
  );
}
