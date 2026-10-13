"use client";

import { Button, buttonVariants } from "@elmeragroup/fuse/button";
import { Input } from "@elmeragroup/fuse/input";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

export function ToolbarInput() {
  return (
    <Toolbar.Root aria-label="Messages">
      <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Mark all read</Toolbar.Button>
      <Toolbar.Link href="/components/toolbar" className={buttonVariants({ variant: "link", size: "sm" })}>
        Help
      </Toolbar.Link>
      <Toolbar.Separator />
      <Toolbar.Input render={<Input aria-label="Search messages" placeholder="Search" className="w-48" />} />
    </Toolbar.Root>
  );
}
