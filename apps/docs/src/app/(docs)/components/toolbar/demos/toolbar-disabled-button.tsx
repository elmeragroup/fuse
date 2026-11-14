"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarDisabledButton() {
  return (
    <Toolbar.Root aria-label="Invoice">
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Download</Toolbar.Button>
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Duplicate</Toolbar.Button>
      <Toolbar.Button disabled render={<Button variant="ghost" size="sm" />}>
        Delete
      </Toolbar.Button>
    </Toolbar.Root>
  );
}
