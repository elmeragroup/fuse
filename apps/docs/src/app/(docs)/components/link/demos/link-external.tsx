"use client";

import { ArrowSquareOut } from "@elmeragroup/fuse/icons";
import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";

export function LinkExternal() {
  return (
    <Text className="max-w-md">
      Fuse follows the{" "}
      <Link href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noreferrer">
        WCAG guidelines
        <ArrowSquareOut data-icon="inline-end" />
        <span className="sr-only"> (opens in a new tab)</span>
      </Link>{" "}
      for contrast and focus.
    </Text>
  );
}
