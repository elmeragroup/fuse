"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Plus } from "@elmeragroup/fuse/icons";

export function ButtonIconLarge() {
  return (
    <Button size="icon-lg" aria-label="Add item">
      <Plus />
    </Button>
  );
}
