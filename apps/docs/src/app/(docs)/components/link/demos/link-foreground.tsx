"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkForeground() {
  return (
    <p className="text-sm max-w-md">
      See{" "}
      <Link href="#price-breakdown" variant="foreground">
        the full price breakdown
      </Link>
      .
    </p>
  );
}
