"use client";

import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarVertical() {
  return (
    <Toolbar.Root aria-label="Zoom" orientation="vertical">
      <Toolbar.Button>Zoom in</Toolbar.Button>
      <Toolbar.Button>Zoom out</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Button>Fit to screen</Toolbar.Button>
    </Toolbar.Root>
  );
}
