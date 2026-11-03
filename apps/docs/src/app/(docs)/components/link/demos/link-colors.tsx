"use client";

import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";

const VARIANTS = ["default", "foreground", "primary", "brand", "muted", "error"] as const;

export function LinkColors() {
  return (
    <div className="max-w-md flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {VARIANTS.map((variant) => (
          <li key={variant}>
            <Link href={`#link-${variant}`} variant={variant}>
              {variant}
            </Link>
          </li>
        ))}
      </ul>
      <Text variant="destructive">
        The payment was declined. <Link href="#update-card">Update your card</Link> to retry it.
      </Text>
    </div>
  );
}
