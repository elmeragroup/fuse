"use client";

import { useState } from "react";

import { Link as AriaLink } from "react-aria-components";

import { Link } from "@elmeragroup/fuse/link";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function UiProvidersBasic() {
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  return (
    <UiProviders
      locale="nb-NO"
      navigate={(url) => {
        console.log(url);
        setLastUrl(url);
      }}>
      <nav aria-label="App">
        <Link render={<AriaLink href="/x" />}>Open /x</Link>
      </nav>
      <output aria-label="Navigation log">{lastUrl ?? "No navigation yet"}</output>
    </UiProviders>
  );
}
