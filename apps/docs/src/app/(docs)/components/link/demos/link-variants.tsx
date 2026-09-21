"use client";

import { Link } from "@elmeragroup/fuse/react-aria/link";

const VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "error",
] as const;

export function LinkVariants() {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {VARIANTS.map((variant) => (
          <Link key={variant} href="#link-variant" variant={variant}>
            {variant}
          </Link>
        ))}
      </p>
      <p className="flex items-baseline gap-4">
        <Link href="#link-weight" weight="normal">
          Normal weight
        </Link>
        <Link href="#link-weight" weight="bold">
          Bold weight
        </Link>
      </p>
      <div className="flex max-w-40 items-center">
        <Link href="#link-truncate" truncate>
          customer-735999123-settlement-march-estimated.csv
        </Link>
      </div>
    </div>
  );
}
