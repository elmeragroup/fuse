"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarVertical() {
  return (
    <Toolbar.Root aria-label="Zoom" orientation="vertical">
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Zoom in</Toolbar.Button>
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Zoom out</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Fit to screen</Toolbar.Button>
    </Toolbar.Root>
  );
}
