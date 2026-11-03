"use client";

import { useState } from "react";

import { Link as AriaLink } from "react-aria-components";

import { Link } from "@elmeragroup/fuse/link";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import { Text } from "@elmeragroup/fuse/text";

export function LinkReactAria() {
  const [routedTo, setRoutedTo] = useState<string | null>(null);

  return (
    <UiProviders locale="en-US" navigate={(path) => setRoutedTo(path)}>
      <div className="flex flex-col gap-3">
        <Text>
          The payment for <Link render={<AriaLink href="/invoices/1042" />}>invoice 1042</Link> is due.
        </Text>
        <output aria-label="Routed path" className="text-sm text-muted-foreground">
          {routedTo ?? "No client navigation yet"}
        </output>
      </div>
    </UiProviders>
  );
}
