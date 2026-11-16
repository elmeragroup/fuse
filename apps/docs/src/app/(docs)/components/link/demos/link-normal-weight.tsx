"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkNormalWeight() {
  return (
    <p className="text-sm font-medium max-w-md">
      Your contract renews on 1 March.{" "}
      <Link href="#renewal" weight="normal">
        Review the renewal
      </Link>
      .
    </p>
  );
}
