"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkTruncate() {
  return (
    <div className="text-sm flex max-w-56">
      <Link href="#settlement-csv" truncate>
        settlement-march-estimated-readings.csv
      </Link>
    </div>
  );
}
