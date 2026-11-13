"use client";

import { Button } from "@elmeragroup/fuse/button";
import { Copy } from "@elmeragroup/fuse/icons";

export function ButtonIconInline() {
  return (
    <p className="text-sm">
      Order number 10482
      <Button size="icon-inline" variant="ghost" aria-label="Copy order number">
        <Copy />
      </Button>
    </p>
  );
}
