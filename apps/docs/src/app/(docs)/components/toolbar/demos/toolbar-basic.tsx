"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Copy, Download, Trash } from "@elmeragroup/fuse/icons";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarBasic() {
  return (
    <Toolbar.Root aria-label="Invoice">
      <Toolbar.Group aria-label="File">
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>
          <Download data-icon="inline-start" aria-hidden />
          Download
        </Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>
          <Copy data-icon="inline-start" aria-hidden />
          Duplicate
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Toolbar.Button render={<Button variant="ghost" size="sm" />} disabled>
        <Trash data-icon="inline-start" aria-hidden />
        Delete
      </Toolbar.Button>
    </Toolbar.Root>
  );
}
