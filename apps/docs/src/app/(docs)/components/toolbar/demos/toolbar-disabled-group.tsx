"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarDisabledGroup() {
  return (
    <Toolbar.Root aria-label="Invoice">
      <Toolbar.Group aria-label="File">
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Download</Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Duplicate</Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Group aria-label="Status" disabled>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Mark paid</Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Cancel</Toolbar.Button>
      </Toolbar.Group>
    </Toolbar.Root>
  );
}
