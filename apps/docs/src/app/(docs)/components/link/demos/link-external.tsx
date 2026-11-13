"use client";

import { ArrowSquareOut } from "@elmeragroup/fuse/icons";
import { Link } from "@elmeragroup/fuse/link";

export function LinkExternal() {
  return (
    <p className="text-sm max-w-md">
      Fuse follows the{" "}
      <Link href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noreferrer">
        WCAG guidelines
        <ArrowSquareOut data-icon="inline-end" />
        <span className="sr-only"> (opens in a new tab)</span>
      </Link>{" "}
      for contrast and focus.
    </p>
  );
}
