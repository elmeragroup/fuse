"use client";

import NextLink from "next/link";

import { Link } from "@elmeragroup/fuse/link";

export function LinkRouter() {
  return (
    <p className="text-sm max-w-md">
      For an action rather than a destination, use a{" "}
      <Link render={<NextLink href="/components/button" />}>Button</Link>.
    </p>
  );
}
