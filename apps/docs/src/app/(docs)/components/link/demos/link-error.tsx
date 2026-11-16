"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkError() {
  return (
    <p className="text-sm max-w-md">
      The payment was declined.{" "}
      <Link href="#update-card" variant="error">
        Update your card
      </Link>{" "}
      to retry it.
    </p>
  );
}
