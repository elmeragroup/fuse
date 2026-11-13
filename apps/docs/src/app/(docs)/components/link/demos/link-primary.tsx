"use client";

import { Link } from "@elmeragroup/fuse/link";

export function LinkPrimary() {
  return (
    <p className="text-sm max-w-md">
      Meter readings arrive each night.{" "}
      <Link href="#reading-schedule" variant="primary">
        See when your meter reports
      </Link>
      .
    </p>
  );
}
