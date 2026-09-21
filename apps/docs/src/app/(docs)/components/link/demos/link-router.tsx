"use client";

import { useState } from "react";

import { Link } from "@elmeragroup/fuse/react-aria/link";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function LinkRouter() {
  const [routedTo, setRoutedTo] = useState<string | null>(null);

  return (
    <UiProviders locale="nb-NO" navigate={(url) => setRoutedTo(url)}>
      <nav aria-label="Invoice" className="flex flex-col items-start gap-2">
        <Link href="/invoices/1042" variant="primary">
          Invoice 1042
        </Link>
        <Link href="https://example.com/status" target="_blank" rel="noreferrer" variant="primary">
          Status page (new tab)
        </Link>
      </nav>
      <output aria-label="Routed path" className="mt-4 block">
        {routedTo ?? "No client navigation yet"}
      </output>
    </UiProviders>
  );
}
