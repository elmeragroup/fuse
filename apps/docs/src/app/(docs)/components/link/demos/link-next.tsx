"use client";

import NextLink from "next/link";

import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";

export function LinkNext() {
  return (
    <Text className="max-w-md">
      For an action rather than a destination, use a{" "}
      <Link render={<NextLink href="/components/button" />}>Button</Link>.
    </Text>
  );
}
