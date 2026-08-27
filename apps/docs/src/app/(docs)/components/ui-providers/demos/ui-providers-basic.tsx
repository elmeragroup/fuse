"use client";

import { useState } from "react";

import { Link } from "react-aria-components";

import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";

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
        <Link href="/x">Open /x</Link>
      </nav>
      <output aria-label="Navigation log">{lastUrl ?? "No navigation yet"}</output>
    </UiProviders>
  );
}
