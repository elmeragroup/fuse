"use client";

import { Button } from "@elmeragroup/fuse/button";
import { X } from "@elmeragroup/fuse/icons";

export function ButtonIconExtraSmall() {
  return (
    <Button size="icon-xs" variant="ghost" aria-label="Close">
      <X />
    </Button>
  );
}
