"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkBrand() {
  return (
    <p className="text-sm max-w-md">
      New to the app?{" "}
      <Link href="#getting-started" variant="brand">
        Start with the guide
      </Link>
      .
    </p>
  );
}
