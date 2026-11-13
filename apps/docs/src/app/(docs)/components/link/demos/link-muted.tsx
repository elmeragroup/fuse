"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkMuted() {
  return (
    <p className="text-sm max-w-md">
      Prices include VAT.{" "}
      <Link href="#vat" variant="muted">
        How VAT is calculated
      </Link>
      .
    </p>
  );
}
