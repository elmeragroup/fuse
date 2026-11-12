"use client";

import { Button } from "@elmeragroup/fuse/button";
import { MagnifyingGlass } from "@elmeragroup/fuse/icons";

export function ButtonIcon() {
  return (
    <Button size="icon" aria-label="Search">
      <MagnifyingGlass />
    </Button>
  );
}
