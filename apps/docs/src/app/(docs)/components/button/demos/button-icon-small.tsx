"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Gear } from "@elmeragroup/fuse/icons";

export function ButtonIconSmall() {
  return (
    <Button size="icon-sm" variant="outline" aria-label="Settings">
      <Gear />
    </Button>
  );
}
