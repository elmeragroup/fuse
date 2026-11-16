"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkBold() {
  return (
    <p className="text-sm max-w-md">
      Your contract renews on 1 March.{" "}
      <Link href="#renewal" weight="bold">
        Review the renewal
      </Link>
      .
    </p>
  );
}
