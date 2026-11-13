"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkDemo() {
  return (
    <p className="text-sm max-w-md">
      Read the <Link href="#terms-of-delivery">terms of delivery</Link> before you confirm the order.
    </p>
  );
}
