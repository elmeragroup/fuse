"use client";

import { SearchField } from "@elmeragroup/fuse/react-aria/search-field";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";

export function SearchFieldSizes() {
  return (
    <UiProviders locale="en-US" navigate={() => undefined}>
      <div className="flex flex-wrap items-start gap-3">
        <SearchField
          size="sm"
          label="Small"
          placeholder="Meter number"
          defaultValue="7070"
          className="w-56"
        />
        <SearchField label="Default" placeholder="Meter number" defaultValue="7070" className="w-56" />
      </div>
    </UiProviders>
  );
}
