"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkNoUnderline() {
  return (
    <div className="max-w-xs flex flex-col gap-1 rounded-lg border border-border p-4">
      <Link href="#invoice-1042" underline="none" weight="bold">
        Invoice 1042
      </Link>
      <p className="text-sm text-muted-foreground">Due 15 March</p>
    </div>
  );
}
