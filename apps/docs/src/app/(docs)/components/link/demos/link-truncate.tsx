"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkTruncate() {
  return (
    <div className="text-sm flex max-w-56 items-center gap-2">
      <span className="shrink-0 text-muted-foreground">File</span>
      <Link href="#settlement-csv" truncate>
        settlement-march-estimated-readings.csv
      </Link>
    </div>
  );
}
