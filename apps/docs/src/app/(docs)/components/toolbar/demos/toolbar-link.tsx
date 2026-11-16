"use client";

import { Button, buttonVariants } from "@elmeragroup/fuse/button";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarLink() {
  return (
    <Toolbar.Root aria-label="Messages">
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Mark all read</Toolbar.Button>
      <Toolbar.Separator />
      <Toolbar.Link href="#help" className={buttonVariants({ variant: "link", size: "sm" })}>
        Help
      </Toolbar.Link>
    </Toolbar.Root>
  );
}
