"use client";

import { Button } from "@elmeragroup/fuse/button";
import { ArrowsOut, Minus, Plus } from "@elmeragroup/fuse/icons";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarVertical() {
  return (
    <Toolbar.Root aria-label="Zoom" orientation="vertical">
      <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Zoom in" />}>
        <Plus aria-hidden />
      </Toolbar.Button>
      <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Zoom out" />}>
        <Minus aria-hidden />
      </Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Fit to screen" />}>
        <ArrowsOut aria-hidden />
      </Toolbar.Button>
    </Toolbar.Root>
  );
}
